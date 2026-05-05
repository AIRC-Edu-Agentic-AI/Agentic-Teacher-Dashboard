from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
import numpy as np

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = MongoClient("mongodb://localhost:27017/")
db = client["oulad_db"]

def compute_weekly_clicks(vle_docs, course_length_days):
    num_weeks = course_length_days // 7
    weekly = [0] * num_weeks
    for doc in vle_docs:
        day = doc.get("date", 0)
        if day is None or str(day) == "?":
            continue
        week = int(day) // 7
        if 0 <= week < num_weeks:
            weekly[week] += int(doc.get("sum_click", 0))
    cumulative = []
    total = 0
    for w in weekly:
        total += w
        cumulative.append(total)
    return weekly, cumulative

def compute_risk(cumulative_clicks, p75):
    risk = []
    for i, cum in enumerate(cumulative_clicks):
        ref = p75[i] if i < len(p75) else 1
        if ref == 0:
            risk.append(0.5)
        else:
            score = 1.0 - min(cum / ref, 1.0)
            risk.append(round(score, 3))
    return risk

def compute_tiers(risk_by_week):
    tiers = []
    for r in risk_by_week:
        if r < 0.33:
            tiers.append(1)
        elif r < 0.66:
            tiers.append(2)
        else:
            tiers.append(3)
    return tiers

@app.get("/api/index")
def get_index():
    courses = list(db["modules"].find({}, {"_id": 0}))
    result = []
    for c in courses:
        length = c.get("module_presentation_length", 269)
        num_weeks = length // 7
        count = db["students"].count_documents({
            "code_module": c["code_module"],
            "code_presentation": c["code_presentation"]
        })
        result.append({
            "module": c["code_module"],
            "presentation": c["code_presentation"],
            "course_length_days": length,
            "num_weeks": num_weeks,
            "student_count": count
        })
    return {"courses": result}

@app.get("/api/course/{module}/{presentation}")
def get_course(module: str, presentation: str):
    course = db["modules"].find_one(
        {"code_module": module, "code_presentation": presentation},
        {"_id": 0}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    course_length = course.get("module_presentation_length", 269)
    num_weeks = course_length // 7

    students = list(db["students"].find(
        {"code_module": module, "code_presentation": presentation},
        {"_id": 0}
    ))

    assessments_meta = list(db["assessments_meta"].find(
        {"code_module": module, "code_presentation": presentation},
        {"_id": 0}
    ))

    all_cumulative = []
    student_profiles = []

    for s in students:
        sid = s["id_student"]

        vle_docs = list(db["vle_interactions"].find(
            {"code_module": module, "code_presentation": presentation, "id_student": sid},
            {"_id": 0, "date": 1, "sum_click": 1}
        ))
        weekly, cumulative = compute_weekly_clicks(vle_docs, course_length)
        all_cumulative.append(cumulative)

        sa_docs = list(db["student_assessments"].find(
            {"id_student": sid},
            {"_id": 0}
        ))
        sa_map = {d["id_assessment"]: d for d in sa_docs}

        assessments = []
        for a in assessments_meta:
            aid = a["id_assessment"]
            sa = sa_map.get(aid, {})
            score_raw = sa.get("score", None)
            score = None if score_raw is None or str(score_raw) == "?" else float(score_raw)
            date_due = a.get("date", None)
            assessments.append({
                "id_assessment": aid,
                "assessment_type": a.get("assessment_type", ""),
                "date_due": int(date_due) if date_due and str(date_due) != "?" else None,
                "weight": float(a.get("weight", 0)),
                "score": score,
                "date_submitted": sa.get("date_submitted", None)
            })

        reg = db["registrations"].find_one(
            {"code_module": module, "code_presentation": presentation, "id_student": sid},
            {"_id": 0}
        )
        date_reg = reg.get("date_registration", 0) if reg else 0
        date_unreg = reg.get("date_unregistration", None) if reg else None

        student_profiles.append({
            "id_student": sid,
            "gender": s.get("gender", ""),
            "region": s.get("region", ""),
            "highest_education": s.get("highest_education", ""),
            "imd_band": s.get("imd_band", ""),
            "age_band": s.get("age_band", ""),
            "num_of_prev_attempts": s.get("num_of_prev_attempts", 0),
            "studied_credits": s.get("studied_credits", 0),
            "disability": s.get("disability", "N") == "Y",
            "final_result": s.get("final_result", ""),
            "date_registration": date_reg,
            "date_unregistration": date_unreg,
            "weekly_clicks": weekly,
            "cumulative_clicks": cumulative,
            "assessments": assessments,
            "risk_by_week": [],
            "tier_by_week": []
        })

    if all_cumulative:
        max_len = max(len(w) for w in all_cumulative)
        arr = np.array([w + [0] * (max_len - len(w)) for w in all_cumulative])
        p75 = np.percentile(arr, 75, axis=0).tolist()
    else:
        p75 = [1] * num_weeks

    for sp in student_profiles:
        risk = compute_risk(sp["cumulative_clicks"], p75)
        sp["risk_by_week"] = risk
        sp["tier_by_week"] = compute_tiers(risk)

    return {
        "module": module,
        "presentation": presentation,
        "course_length_days": course_length,
        "num_weeks": num_weeks,
        "students": student_profiles,
        "cohort_p75_clicks": p75
    }

@app.get("/api/student/{module}/{presentation}/{student_id}")
def get_student(module: str, presentation: str, student_id: int):
    course = get_course(module, presentation)
    for s in course["students"]:
        if s["id_student"] == student_id:
            return s
    raise HTTPException(status_code=404, detail="Student not found")