"""
OULAD Preprocessing Script (Fixed + Temporal Decay)
==================================================

Reads the 7 OULAD CSV files from public/data/oulad/
Computes per-student per-week risk scores
Writes JSON files to public/processed/

Enhancements:
- Temporal decay on engagement (exponential)
- Strict null handling
- Correct submission semantics
- Registration-aware masking
- Stable normalization

Usage:
    python scripts/python/preprocess.py
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

CHUNK_SIZE = 100_000
DECAY_LAMBDA = 0.15  # temporal decay strength


# ── Helpers ───────────────────────────────────────────────────────────────────

def csv(name: str) -> Path:
    p = CSV_DIR / name
    if not p.exists():
        sys.exit(
            f"\n❌ Missing: {p}\n"
            f"Place all 7 OULAD CSV files in: {CSV_DIR}\n"
        )
    return p


def load_small(name: str) -> pd.DataFrame:
    print(f"  Loading {name}…", flush=True)
    return pd.read_csv(csv(name))


def compute_decayed_cumulative(clicks: np.ndarray, decay_lambda: float) -> np.ndarray:
    """Exponential temporal decay of engagement."""
    n = len(clicks)
    decayed = np.zeros(n, dtype=np.float32)

    for t in range(n):
        weights = np.exp(-decay_lambda * (t - np.arange(t + 1)))
        decayed[t] = float(np.sum(clicks[:t + 1] * weights))

    return decayed


def compute_risk(week_idx, decayed_clicks, p75_decayed, assessments_due):
    """Compute risk score and tier."""

    # ── Engagement ──
    clicks = float(decayed_clicks[week_idx]) if week_idx < len(decayed_clicks) else 0.0
    p75 = float(p75_decayed[week_idx]) if week_idx < len(p75_decayed) else 1.0
    p75 = max(p75, 5.0)

    engagement = min(1.0, clicks / p75)

    # ── Assessments ──
    if assessments_due.empty:
        assessment_perf = 0.0
        submission_rate = 0.0
    else:
        weights = assessments_due["weight"].fillna(0.0)
        scores = assessments_due["score"]

        on_time = assessments_due["status"] == "submitted_on_time"

        weighted_score = (
            (scores[on_time] / 100.0 * weights[on_time]).sum()
        )

        total_weight = weights.sum()

        assessment_perf = (
            float(weighted_score / total_weight)
            if total_weight > 0 else 0.0
        )

        submission_rate = on_time.sum() / len(assessments_due)

    risk = 1.0 - (
        0.45 * assessment_perf +
        0.35 * engagement +
        0.20 * submission_rate
    )

    risk = round(max(0.0, min(1.0, risk)), 4)
    tier = 1 if risk < 0.33 else (2 if risk < 0.66 else 3)

    return risk, tier


def safe(val: Any) -> Any:
    if isinstance(val, float) and math.isnan(val):
        return None
    if isinstance(val, (np.integer,)):
        return int(val)
    if isinstance(val, (np.floating,)):
        return float(val)
    return val


def deep_safe(obj):
    if isinstance(obj, dict):
        return {k: deep_safe(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [deep_safe(v) for v in obj]
    elif isinstance(obj, float) and math.isnan(obj):
        return None
    elif isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    return obj


# ── Load small tables ─────────────────────────────────────────────────────────

print("\n🔄 Loading OULAD tables…")
courses_df     = load_small("courses.csv")
info_df        = load_small("studentInfo.csv")
reg_df         = load_small("studentRegistration.csv")
assessments_df = load_small("assessments.csv")


# ── Stream studentAssessment.csv ──────────────────────────────────────────────

print("  Streaming studentAssessment.csv…", flush=True)

score_map = {}

for chunk in pd.read_csv(csv("studentAssessment.csv"), chunksize=CHUNK_SIZE):
    for _, row in chunk.iterrows():
        sid = int(row["id_student"])
        aid = int(row["id_assessment"])

        score = None if pd.isna(row["score"]) else float(row["score"])
        date_sub = None if pd.isna(row["date_submitted"]) else int(row["date_submitted"])

        score_map.setdefault(sid, {})[aid] = (score, date_sub)

print(f"    → {len(score_map):,} students with assessment records")


# ── Stream studentVle.csv ─────────────────────────────────────────────────────

print("  Streaming studentVle.csv…", flush=True)

weekly_clicks = {}

chunks = pd.read_csv(csv("studentVle.csv"), chunksize=CHUNK_SIZE)

for chunk in tqdm(chunks, desc="  VLE chunks", unit="chunk", leave=False):
    chunk = chunk[chunk["date"] > 0].copy()
    chunk["week"] = ((chunk["date"] - 1) // 7).astype(int)

    grouped = chunk.groupby(
        ["code_module", "code_presentation", "id_student", "week"]
    )["sum_click"].sum()

    for (mod, pres, sid, week), clicks in grouped.items():
        key = (str(mod), str(pres), int(sid), int(week))
        weekly_clicks[key] = weekly_clicks.get(key, 0) + int(clicks)

print(f"    → {len(weekly_clicks):,} VLE records aggregated")


# ── Process each course ───────────────────────────────────────────────────────

OUT_DIR.mkdir(parents=True, exist_ok=True)
index_courses = []

print(f"\n⚙️ Processing {len(courses_df)} courses…\n")

for _, course_row in courses_df.iterrows():

    mod  = str(course_row["code_module"])
    pres = str(course_row["code_presentation"])
    key = f"{mod}_{pres}"

    length_days = int(course_row["module_presentation_length"])
    num_weeks = math.ceil(length_days / 7)

    students = info_df[
        (info_df["code_module"] == mod) &
        (info_df["code_presentation"] == pres)
    ].copy()

    if students.empty:
        continue

    regs = reg_df[
        (reg_df["code_module"] == mod) &
        (reg_df["code_presentation"] == pres)
    ].set_index("id_student")

    pres_assessments = assessments_df[
        (assessments_df["code_module"] == mod) &
        (assessments_df["code_presentation"] == pres)
    ].copy()

    student_ids = students["id_student"].tolist()

    # ── Weekly clicks ──
    weekly_arr = {}
    for sid in student_ids:
        arr = np.zeros(num_weeks, dtype=np.int32)
        for w in range(num_weeks):
            arr[w] = weekly_clicks.get((mod, pres, sid, w), 0)
        weekly_arr[sid] = arr

    # ── Decayed engagement ──
    decayed_arr = {
        sid: compute_decayed_cumulative(weekly_arr[sid], DECAY_LAMBDA)
        for sid in student_ids
    }

    all_decayed = np.stack([decayed_arr[sid] for sid in student_ids])
    p75_decayed = np.percentile(all_decayed, 75, axis=0)
    p75_decayed = np.maximum(p75_decayed, 5.0)

    processed_students = []

    for _, s_row in tqdm(students.iterrows(), total=len(students), desc=key, leave=False):

        sid = int(s_row["id_student"])
        s_score_map = score_map.get(sid, {})

        reg_row = regs.loc[sid] if sid in regs.index else None
        date_reg = int(reg_row["date_registration"]) if reg_row is not None and not pd.isna(reg_row["date_registration"]) else 0
        date_unreg = int(reg_row["date_unregistration"]) if reg_row is not None and not pd.isna(reg_row["date_unregistration"]) else None

        decayed = decayed_arr[sid]

        risk_by_week = []
        tier_by_week = []

        for w in range(num_weeks):

            current_day = (w + 1) * 7

            if current_day < date_reg:
                risk_by_week.append(None)
                tier_by_week.append(None)
                continue

            if date_unreg is not None and current_day > date_unreg:
                risk_by_week.append(None)
                tier_by_week.append(None)
                continue

            due_now = pres_assessments[
                pres_assessments["date"] <= current_day
            ].copy()

            if not due_now.empty:
                records = []

                for aid in due_now["id_assessment"]:
                    score, date_sub = s_score_map.get(int(aid), (None, None))

                    if date_sub is None:
                        status = "not_submitted"
                    elif date_sub <= current_day:
                        status = "submitted_on_time"
                    else:
                        status = "late"

                    records.append((score, status))

                due_now["score"] = [r[0] for r in records]
                due_now["status"] = [r[1] for r in records]

            risk, tier = compute_risk(w, decayed, p75_decayed, due_now)

            risk_by_week.append(risk)
            tier_by_week.append(tier)

        student_assessments = []
        for _, a_row in pres_assessments.iterrows():
            aid = int(a_row["id_assessment"])
            score, date_sub = s_score_map.get(aid, (None, None))
            date_due = None if pd.isna(a_row["date"]) else int(a_row["date"])
            student_assessments.append({
                "id_assessment": aid,
                "assessment_type": str(a_row["assessment_type"]),
                "date_due": date_due,
                "weight": float(a_row["weight"]) if not pd.isna(a_row["weight"]) else None,
                "score": score,
                "date_submitted": date_sub,
            })

        processed_students.append({
            "id_student": sid,
            "gender": str(s_row["gender"]),
            "region": str(s_row["region"]),
            "highest_education": str(s_row["highest_education"]),
            "imd_band": None if pd.isna(s_row["imd_band"]) else str(s_row["imd_band"]),
            "age_band": str(s_row["age_band"]),
            "num_of_prev_attempts": int(s_row["num_of_prev_attempts"]),
            "studied_credits": int(s_row["studied_credits"]),
            "disability": str(s_row["disability"]) == "Y",
            "final_result": str(s_row["final_result"]),
            "date_registration": date_reg,
            "date_unregistration": date_unreg,
            "assessments": student_assessments,
            "weekly_clicks": weekly_arr[sid].tolist(),
            "decayed_engagement": decayed.tolist(),
            "risk_by_week": risk_by_week,
            "tier_by_week": tier_by_week,
        })

    output = {
        "module": mod,
        "presentation": pres,
        "num_weeks": num_weeks,
        "cohort_p75_decayed": p75_decayed.tolist(),
        "students": processed_students,
    }

    out_path = OUT_DIR / f"{key}.json"

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(deep_safe(output), f, separators=(",", ":"))

    print(f"✓ {key}: {len(processed_students)} students")

    index_courses.append({
        "module": mod,
        "presentation": pres,
        "num_weeks": num_weeks,
        "student_count": len(processed_students),
    })


# ── Index ─────────────────────────────────────────────────────────────────────

index_path = OUT_DIR / "index.json"

with open(index_path, "w", encoding="utf-8") as f:
    json.dump({"courses": index_courses}, f, indent=2)

print(f"\n✅ Done. Output in {OUT_DIR}")