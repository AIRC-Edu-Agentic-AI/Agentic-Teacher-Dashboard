import express from 'express'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import dns from 'dns'
import { classroomRoutes } from './routes/classrooms.ts'
import { assessmentRoutes } from './routes/assessments.ts'

dotenv.config()

dns.setServers(['8.8.8.8', '1.1.1.1'])

const app = express()
const PORT = 8000

const MONGO_URI = process.env.MONGODB_URI
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173'

if (!MONGO_URI) {
  console.error('Missing required env var: MONGODB_URI')
  process.exit(1)
}

const client = new MongoClient(MONGO_URI)
const db = client.db(process.env.MONGODB_DB ?? 'oulad_db')

app.use(cors({ origin: CORS_ORIGIN }))
app.use(express.json())

// Helper to simulate complete dynamic student profiles for custom classrooms
function simulateStudentProfile(s: any): any {
  const id = s.id_student;
  const result = s.final_result || 'Pass';
  const numWeeks = 39;

  // 1. Generate weekly clicks
  const weekly_clicks: number[] = [];
  let withdrawnWeek = -1;
  if (result === 'Withdrawn') {
    withdrawnWeek = Math.floor(8 + Math.random() * 15); // Withdraws between week 8 and 23
  }

  for (let w = 0; w < numWeeks; w++) {
    if (withdrawnWeek !== -1 && w > withdrawnWeek) {
      weekly_clicks.push(0);
    } else {
      if (result === 'Pass' || result === 'Distinction') {
        weekly_clicks.push(Math.round(40 + Math.random() * 80));
      } else if (result === 'Fail') {
        weekly_clicks.push(Math.round(10 + Math.random() * 30));
      } else { // Withdrawn active period
        weekly_clicks.push(Math.round(25 + Math.random() * 40));
      }
    }
  }

  // 2. Decayed Engagement Matrix: E_w = C_w + e^-0.15 * E_w-1
  const decayed_engagement: number[] = [];
  let lastDecay = 0;
  for (const clicks of weekly_clicks) {
    lastDecay = clicks + Math.exp(-0.15) * lastDecay;
    decayed_engagement.push(Number(lastDecay.toFixed(4)));
  }

  // 3. Define 4 standard assessments
  const assess_configs = [
    { id: 1001, name: 'TMA 1', type: 'TMA', week: 5, weight: 10 },
    { id: 1002, name: 'TMA 2', type: 'TMA', week: 15, weight: 20 },
    { id: 1003, name: 'TMA 3', type: 'TMA', week: 25, weight: 30 },
    { id: 1004, name: 'Exam', type: 'Exam', week: 39, weight: 40 }
  ];

  const assessments = assess_configs.map(cfg => {
    const isSubmitted = withdrawnWeek === -1 || cfg.week <= withdrawnWeek;
    let score = null;
    let submitDate = null;

    if (isSubmitted) {
      submitDate = Math.round((cfg.week * 7) - 3 + Math.random() * 5); // Submit around due date
      if (result === 'Pass' || result === 'Distinction') {
        score = Math.round(75 + Math.random() * 23); // 75 - 98
      } else if (result === 'Fail') {
        score = Math.round(30 + Math.random() * 25); // 30 - 55
      } else {
        score = Math.round(45 + Math.random() * 20); // 45 - 65
      }
    }

    return {
      id_assessment: cfg.id,
      assessment_type: cfg.type,
      date_due: cfg.week * 7,
      weight: cfg.weight,
      score: score,
      date_submitted: submitDate
    };
  });

  // 4. Generate week-by-week risk and tier
  const risk_by_week: (number | null)[] = [];
  const tier_by_week: (number | null)[] = [];

  for (let w = 0; w < numWeeks; w++) {
    if (withdrawnWeek !== -1 && w > withdrawnWeek) {
      risk_by_week.push(1.0);
      tier_by_week.push(3);
    } else {
      let baseRisk = 0.3;
      if (result === 'Pass' || result === 'Distinction') {
        // Risk decreases over time
        baseRisk = 0.25 - (w / numWeeks) * 0.15 + (Math.random() * 0.08 - 0.04);
      } else if (result === 'Fail') {
        // Risk increases over time
        baseRisk = 0.4 + (w / numWeeks) * 0.35 + (Math.random() * 0.1 - 0.05);
      } else {
        baseRisk = 0.35 + (w / numWeeks) * 0.15 + (Math.random() * 0.08 - 0.04);
      }
      
      const finalRisk = Math.min(1.0, Math.max(0.0, Number(baseRisk.toFixed(4))));
      risk_by_week.push(finalRisk);
      
      const tier = finalRisk < 0.33 ? 1 : finalRisk < 0.66 ? 2 : 3;
      tier_by_week.push(tier);
    }
  }

  // 5. Setup mock LSTM horizons
  const lstm_trajectories: any = { w05: [], w10: [], w15: [], w20: [], w25: [] };
  const horizons = ['w05', 'w10', 'w15', 'w20', 'w25'];
  horizons.forEach(hz => {
    lstm_trajectories[hz] = risk_by_week.map((r, i) => {
      if (r === null) return null;
      return Math.min(1.0, Math.max(0.0, Number((r + (Math.random() * 0.06 - 0.03)).toFixed(4))));
    });
  });

  return {
    id_student: id,
    gender: s.gender || 'M',
    region: s.region || 'Unknown Region',
    highest_education: s.highest_education || 'HE Qualification',
    imd_band: s.imd_band || '50-60%',
    age_band: s.age_band || '0-35',
    num_of_prev_attempts: s.num_of_prev_attempts || 0,
    studied_credits: s.studied_credits || 60,
    disability: !!s.disability,
    final_result: result,
    date_registration: s.date_registration || -10,
    date_unregistration: withdrawnWeek !== -1 ? withdrawnWeek * 7 : null,
    weekly_clicks,
    decayed_engagement,
    assessments,
    risk_by_week,
    tier_by_week,
    lstm_trajectories
  };
}

app.get('/api/index', async (_req, res) => {
  const processedCourses = await db.collection("processed_courses").find({}, { projection: { students: 0 } }).toArray()
  const ouladResult = processedCourses.map(c => ({
    module: c.module,
    module_name: c.module_name || c.module,
    presentation: c.presentation,
    presentation_name: c.presentation_name || c.presentation,
    course_length_days: c.num_weeks * 7,
    num_weeks: c.num_weeks,
    student_count: c.student_count || 0
  }))

  const classrooms = await db.collection("classrooms").find({}).toArray()
  const customResult = classrooms.map(c => ({
    module: c.module,
    module_name: `${c.name} (Custom)`,
    presentation: c.code_presentation,
    presentation_name: c.code_presentation,
    course_length_days: 39 * 7,
    num_weeks: 39,
    student_count: c.student_ids?.length || 0
  }))

  const merged = [...ouladResult]
  const seen = new Set(merged.map(c => `${c.module}_${c.presentation}`))
  for (const c of customResult) {
    const key = `${c.module}_${c.presentation}`
    if (!seen.has(key)) {
      merged.push(c)
      seen.add(key)
    }
  }

  res.json({ courses: merged })
})

app.get('/api/course/:module/:presentation', async (req, res) => {
  const { module, presentation } = req.params
  
  let course = await db.collection("processed_courses").findOne(
    { module, presentation },
    { projection: { _id: 0 } }
  )

  let students = []
  if (course) {
    students = await db.collection("processed_students").find(
      { code_module: module, code_presentation: presentation },
      { projection: { _id: 0 } }
    ).toArray()
  } else {
    const classroom = await db.collection("classrooms").findOne({ module, code_presentation: presentation })
    if (!classroom) return res.status(404).json({ error: "Course not found" })

    course = {
      module,
      presentation,
      num_weeks: 39,
      cohort_p75_decayed: Array(39).fill(100.0)
    }

    const customStudents = await db.collection("custom_students").find({
      code_module: module,
      code_presentation: presentation
    }, { projection: { _id: 0 } }).toArray()

    students = customStudents.map(s => simulateStudentProfile(s))
  }

  res.json({ ...course, students })
})

app.get('/api/student/:module/:presentation/:student_id', async (req, res) => {
  const { module, presentation, student_id } = req.params
  let student = await db.collection("processed_students").findOne(
    { code_module: module, code_presentation: presentation, id_student: parseInt(student_id) },
    { projection: { _id: 0 } }
  )
  
  if (!student) {
    const custom = await db.collection("custom_students").findOne(
      { code_module: module, code_presentation: presentation, id_student: parseInt(student_id) },
      { projection: { _id: 0 } }
    )
    if (custom) {
      student = simulateStudentProfile(custom)
    }
  }

  if (!student) return res.status(404).json({ error: "Student not found" })
  res.json(student)
})

// Mount classrooms and assessments routes directly
app.use('/api/classrooms', classroomRoutes(db))
app.use('/api/classrooms', assessmentRoutes(db))

async function start() {
  await client.connect()
  console.log("Connected to MongoDB Atlas!")
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
}

start()