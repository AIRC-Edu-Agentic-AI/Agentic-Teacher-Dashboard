from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pymongo import MongoClient
from typing import Optional

app = FastAPI()

# Autorise le frontend Vite (port 5173) à appeler l'API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = MongoClient("mongodb://localhost:27017/")
db = client["oulad_db"]
col = db["student_assessments_enriched"]

@app.get("/api/index")
def get_index():
    courses = col.distinct("code_module")
    result = []
    for module in courses:
        presentations = col.distinct("code_presentation", {"code_module": module})
        for pres in presentations:
            count = col.count_documents({"code_module": module, "code_presentation": pres})
            result.append({
                "module": module,
                "presentation": pres,
                "student_count": count
            })
    return {"courses": result}

@app.get("/api/course/{module}/{presentation}")
def get_course(module: str, presentation: str):
    docs = list(col.find(
        {"code_module": module, "code_presentation": presentation},
        {"_id": 0}
    ))
    if not docs:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"module": module, "presentation": presentation, "students": docs}

@app.get("/api/student/{module}/{presentation}/{student_id}")
def get_student(module: str, presentation: str, student_id: int):
    doc = col.find_one(
        {"code_module": module, "code_presentation": presentation, "id_student": student_id},
        {"_id": 0}
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Student not found")
    return doc