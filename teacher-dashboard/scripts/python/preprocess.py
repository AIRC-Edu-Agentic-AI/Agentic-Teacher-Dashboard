"""
OULAD Preprocessing Script
===========================
Reads the 7 OULAD CSV files from public/data/oulad/
Computes per-student per-week risk scores
Writes JSON files to public/processed/

Memory strategy
---------------
- Small files (courses, studentInfo, registrations, assessments): read fully
- Large files (studentVle, studentAssessment): read in chunks of 100k rows

Risk formula
------------
risk = 1 - (0.45 * assessment_performance + 0.35 * vle_engagement + 0.20 * submission_rate)

    assessment_performance = weighted score across all assessments due by that week
    vle_engagement         = cumulative clicks / cohort P75 cumulative clicks (clamped to 1)
    submission_rate        = fraction of due assessments that were submitted

Tier thresholds
---------------
Tier 1 (low risk)  : risk < 0.33
Tier 2 (moderate)  : 0.33 <= risk < 0.66
Tier 3 (high risk) : risk >= 0.66

Usage
-----
    python scripts/python/preprocess.py

Output
------
    public/processed/index.json
    public/processed/<MODULE>_<PRESENTATION>.json   (one per course)
"""

import json
import math
import os
import sys
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
from tqdm import tqdm

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[2]
CSV_DIR = ROOT / "public" / "data" / "oulad"
OUT_DIR = ROOT / "public" / "processed"

CHUNK_SIZE = 100_000  # rows per chunk for large files


# ── Helpers ───────────────────────────────────────────────────────────────────

def csv(name: str) -> Path:
    p = CSV_DIR / name
    if not p.exists():
        sys.exit(
            f"\n❌  Missing: {p}"
            f"\n    Place all 7 OULAD CSV files in:  {CSV_DIR}\n"
        )
    return p


def load_small(name: str) -> pd.DataFrame:
    print(f"  Loading {name}…", flush=True)
    return pd.read_csv(csv(name))


def compute_risk(
    week_idx: int,
    cum_clicks: np.ndarray,
    p75_cum_clicks: np.ndarray,
    assessments_due: pd.DataFrame,  # rows: weight, score (NaN = not submitted)
) -> tuple[float, int]:
    """Return (risk_score, tier) for a student at a given week (0-indexed)."""

    # 1. VLE engagement
    clicks = float(cum_clicks[week_idx]) if week_idx < len(cum_clicks) else 0.0
    p75 = float(p75_cum_clicks[week_idx]) if week_idx < len(p75_cum_clicks) else 1.0
    engagement = min(1.0, clicks / max(p75, 1.0))

    # 2. Assessment performance + submission rate
    if assessments_due.empty:
        assessment_perf = 0.5
        submission_rate = 0.5
    else:
        submitted = assessments_due.dropna(subset=["score"])
        total_weight = assessments_due["weight"].sum()
        weighted_score = (submitted["score"] / 100.0 * submitted["weight"]).sum()
        assessment_perf = float(weighted_score / total_weight) if total_weight > 0 else 0.0
        submission_rate = len(submitted) / len(assessments_due)

    risk = 1.0 - (0.45 * assessment_perf + 0.35 * engagement + 0.20 * submission_rate)
    risk = round(max(0.0, min(1.0, risk)), 4)
    tier = 1 if risk < 0.33 else (2 if risk < 0.66 else 3)
    return risk, tier


def safe(val: Any) -> Any:
    """Convert NaN / numpy types to JSON-serialisable Python types."""
    if isinstance(val, float) and math.isnan(val):
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return float(val)
    return val


# ── Load small tables ─────────────────────────────────────────────────────────

print("\n🔄  Loading OULAD tables…")
courses_df      = load_small("courses.csv")
info_df         = load_small("studentInfo.csv")
reg_df          = load_small("studentRegistration.csv")
assessments_df  = load_small("assessments.csv")

# ── Stream studentAssessment.csv ──────────────────────────────────────────────
# Key: id_student  →  { id_assessment → (score, date_submitted) }

print("  Streaming studentAssessment.csv…", flush=True)
score_map: dict[int, dict[int, tuple[float | None, int | None]]] = {}

for chunk in pd.read_csv(csv("studentAssessment.csv"), chunksize=CHUNK_SIZE):
    for _, row in chunk.iterrows():
        sid = int(row["id_student"])
        aid = int(row["id_assessment"])
        score = None if pd.isna(row["score"]) else float(row["score"])
        date_sub = None if pd.isna(row["date_submitted"]) else int(row["date_submitted"])
        score_map.setdefault(sid, {})[aid] = (score, date_sub)

print(f"    → {len(score_map):,} students with assessment records")

# ── Stream studentVle.csv ─────────────────────────────────────────────────────
# Aggregate into: (code_module, code_presentation, id_student, week_number) → sum_click

print("  Streaming studentVle.csv (this is the large one)…", flush=True)
# weekly_clicks[(mod, pres, sid, week)] = total clicks that week
weekly_clicks: dict[tuple[str, str, int, int], int] = {}

chunks = pd.read_csv(csv("studentVle.csv"), chunksize=CHUNK_SIZE)
for chunk in tqdm(chunks, desc="  VLE chunks", unit="chunk", leave=False):
    # Drop pre-course rows (negative date values)
    chunk = chunk[chunk["date"] > 0]
    chunk = chunk.copy()
    chunk["week"] = ((chunk["date"] - 1) // 7).astype(int)

    grouped = (
        chunk.groupby(["code_module", "code_presentation", "id_student", "week"])["sum_click"]
        .sum()
    )
    for (mod, pres, sid, week), clicks in grouped.items():
        key = (str(mod), str(pres), int(sid), int(week))
        weekly_clicks[key] = weekly_clicks.get(key, 0) + int(clicks)

print(f"    → {len(weekly_clicks):,} (student × week) VLE records aggregated")

# ── Process each course ───────────────────────────────────────────────────────

OUT_DIR.mkdir(parents=True, exist_ok=True)
index_courses = []

print(f"\n⚙️   Processing {len(courses_df)} course presentations…\n")

for _, course_row in courses_df.iterrows():
    mod  = str(course_row["code_module"])
    pres = str(course_row["code_presentation"])
    length_days = int(course_row["module_presentation_length"])
    num_weeks = math.ceil(length_days / 7)
    key = f"{mod}_{pres}"

    # Students for this presentation
    students = info_df[
        (info_df["code_module"] == mod) & (info_df["code_presentation"] == pres)
    ].copy()

    if students.empty:
        print(f"  ⚠  {key}: no students — skipping")
        continue

    # Registrations
    regs = reg_df[
        (reg_df["code_module"] == mod) & (reg_df["code_presentation"] == pres)
    ].set_index("id_student")

    # Assessments for this presentation
    pres_assessments = assessments_df[
        (assessments_df["code_module"] == mod) & (assessments_df["code_presentation"] == pres)
    ].copy()

    # Build per-student weekly clicks arrays (num_weeks long)
    student_ids = students["id_student"].tolist()

    # weekly_arr[sid][week] = clicks
    weekly_arr: dict[int, np.ndarray] = {}
    for sid in student_ids:
        arr = np.zeros(num_weeks, dtype=np.int32)
        for w in range(num_weeks):
            arr[w] = weekly_clicks.get((mod, pres, sid, w), 0)
        weekly_arr[sid] = arr

    # Cumulative clicks per student
    cum_arr: dict[int, np.ndarray] = {
        sid: np.cumsum(weekly_arr[sid]) for sid in student_ids
    }

    # Cohort P75 cumulative clicks at each week
    all_cum = np.stack([cum_arr[sid] for sid in student_ids])  # shape (n_students, n_weeks)
    p75_cum = np.percentile(all_cum, 75, axis=0)               # shape (n_weeks,)

    # Build output students list
    processed_students = []

    for _, s_row in tqdm(students.iterrows(), total=len(students), desc=f"  {key}", leave=False):
        sid = int(s_row["id_student"])

        reg_row = regs.loc[sid] if sid in regs.index else None
        date_reg   = int(reg_row["date_registration"])   if reg_row is not None and not pd.isna(reg_row["date_registration"])   else 0
        date_unreg = int(reg_row["date_unregistration"]) if reg_row is not None and not pd.isna(reg_row["date_unregistration"]) else None

        # Assessment records for this student
        s_score_map = score_map.get(sid, {})
        assessment_records = []
        for _, a_row in pres_assessments.iterrows():
            aid = int(a_row["id_assessment"])
            score, date_sub = s_score_map.get(aid, (None, None))
            assessment_records.append({
                "id_assessment": aid,
                "assessment_type": str(a_row["assessment_type"]),
                "date_due": int(a_row["date"]),
                "weight": float(a_row["weight"]),
                "score": score,
                "date_submitted": date_sub,
            })

        cum = cum_arr[sid]

        # Risk + tier per week
        risk_by_week = []
        tier_by_week = []
        for w in range(num_weeks):
            day_threshold = (w + 1) * 7
            due_now = pres_assessments[pres_assessments["date"] <= day_threshold].copy()
            if not due_now.empty:
                due_now = due_now.copy()
                scores_list = [s_score_map.get(int(a), (None, None))[0] for a in due_now["id_assessment"]]
                due_now["score"] = scores_list
            risk, tier = compute_risk(w, cum, p75_cum, due_now)
            risk_by_week.append(risk)
            tier_by_week.append(tier)

        processed_students.append({
            "id_student": sid,
            "gender": safe(s_row.get("gender")),
            "region": safe(s_row.get("region")),
            "highest_education": safe(s_row.get("highest_education")),
            "imd_band": safe(s_row.get("imd_band")),
            "age_band": safe(s_row.get("age_band")),
            "num_of_prev_attempts": safe(s_row.get("num_of_prev_attempts")),
            "studied_credits": safe(s_row.get("studied_credits")),
            "disability": str(s_row.get("disability", "N")).strip().upper() == "Y",
            "final_result": safe(s_row.get("final_result")),
            "date_registration": date_reg,
            "date_unregistration": date_unreg,
            "weekly_clicks": weekly_arr[sid].tolist(),
            "cumulative_clicks": cum.tolist(),
            "assessments": assessment_records,
            "risk_by_week": risk_by_week,
            "tier_by_week": tier_by_week,
        })

    output = {
        "module": mod,
        "presentation": pres,
        "course_length_days": length_days,
        "num_weeks": num_weeks,
        "cohort_p75_clicks": p75_cum.tolist(),
        "students": processed_students,
    }

    out_path = OUT_DIR / f"{key}.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, separators=(",", ":"))  # compact — no pretty-print

    print(f"  ✓  {key}: {len(processed_students):,} students → {out_path.name}")

    index_courses.append({
        "module": mod,
        "presentation": pres,
        "course_length_days": length_days,
        "num_weeks": num_weeks,
        "student_count": len(processed_students),
    })

# ── Write index ───────────────────────────────────────────────────────────────

index_path = OUT_DIR / "index.json"
with open(index_path, "w", encoding="utf-8") as f:
    json.dump({"courses": index_courses}, f, indent=2)

print(f"\n✅  Done — {len(index_courses)} courses written to {OUT_DIR}")
print("    Run: npm run dev\n")
