from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = MongoClient("mongodb+srv://whitedevil0981907116_db_user:airc@ouladcluster.tsrzoux.mongodb.net/?appName=OuladCluster")
db = client["oulad_db"]

@app.get("/api/index")
def get_index():
    courses = list(db["processed_courses"].find({}, {"_id": 0}))
    result = []
    for c in courses:
        result.append({
            "module":            c["module"],
            "presentation":      c["presentation"],
            "course_length_days": c["num_weeks"] * 7,
            "num_weeks":         c["num_weeks"],
            "student_count":     c["student_count"]
        })
    return {"courses": result}

@app.get("/api/course/{module}/{presentation}")
def get_course(module: str, presentation: str):
    course = db["processed_courses"].find_one(
        {"module": module, "presentation": presentation},
        {"_id": 0}
    )
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    students = list(db["processed_students"].find(
        {"code_module": module, "code_presentation": presentation},
        {"_id": 0}
    ))

    return {
        "module":             course["module"],
        "presentation":       course["presentation"],
        "course_length_days": course["num_weeks"] * 7,
        "num_weeks":          course["num_weeks"],
        "cohort_p75_decayed": course.get("cohort_p75_decayed", []),
        "students":           students
    }

@app.get("/api/student/{module}/{presentation}/{student_id}")
def get_student(module: str, presentation: str, student_id: int):
    student = db["processed_students"].find_one(
        {"code_module": module, "code_presentation": presentation, "id_student": student_id},
        {"_id": 0}
    )
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    return student