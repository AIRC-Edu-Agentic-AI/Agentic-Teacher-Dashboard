import express from 'express'
import cors from 'cors'
import { MongoClient, ObjectId } from 'mongodb'
import dotenv from 'dotenv'
import { validateScheduleEvent } from '../src/shared/scheduleEventValidation'

dotenv.config()

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

app.get('/api/index', async (_req, res) => {
  const courses = await db.collection("processed_courses").find({}, { projection: { students: 0 } }).toArray()
  const result = courses.map(c => ({
    module: c.module,
    module_name: c.module_name,
    presentation: c.presentation,
    presentation_name: c.presentation_name,
    course_length_days: c.num_weeks * 7,
    num_weeks: c.num_weeks,
    student_count: c.student_count
  }))
  res.json({ courses: result })
})

app.get('/api/course/:module/:presentation', async (req, res) => {
  const { module, presentation } = req.params
  const course = await db.collection("processed_courses").findOne(
    { module, presentation },
    { projection: { _id: 0 } }
  )
  if (!course) return res.status(404).json({ error: "Course not found" })

  const students = await db.collection("processed_students").find(
    { code_module: module, code_presentation: presentation },
    { projection: { _id: 0 } }
  ).toArray()

  res.json({ ...course, students })
})

app.get('/api/student/:module/:presentation/:student_id', async (req, res) => {
  const { module, presentation, student_id } = req.params
  const student = await db.collection("processed_students").findOne(
    { code_module: module, code_presentation: presentation, id_student: parseInt(student_id) },
    { projection: { _id: 0 } }
  )
  if (!student) return res.status(404).json({ error: "Student not found" })
  res.json(student)
})

app.post('/api/students/import', async (req, res) => {
  try {
    const { students } = req.body
    if (!Array.isArray(students)) {
      return res.status(400).json({ error: "Invalid data format" })
    }
    const result = await db.collection("students").insertMany(students)
    res.status(200).json({ message: "Imported successfully", count: result.insertedCount })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/schedule-events', async (req, res) => {
  try {
    const { module, presentation, kind } = req.query
    const filter: Record<string, unknown> = {}
    if (module) filter.module = module
    if (presentation) filter.presentation = presentation
    if (kind) filter.kind = kind
    const events = await db.collection('schedule_events').find(filter).sort({ date: 1 }).toArray()
    res.status(200).json(events)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/schedule-events', async (req, res) => {
  try {
    const errors = validateScheduleEvent(req.body)
    if (errors.length) return res.status(400).json({ error: errors.join('; ') })
    const event = { ...req.body, created_at: new Date().toISOString() }
    delete event._id
    const result = await db.collection('schedule_events').insertOne(event)
    res.status(201).json({ _id: result.insertedId, ...event })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.patch('/api/schedule-events/:id', async (req, res) => {
  try {
    const patch = { ...req.body }
    delete patch._id
    const result = await db.collection('schedule_events').findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: patch },
      { returnDocument: 'after' },
    )
    if (!result) return res.status(404).json({ error: 'Not found' })
    res.status(200).json(result)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.delete('/api/schedule-events/:id', async (req, res) => {
  try {
    const result = await db.collection('schedule_events').deleteOne({ _id: new ObjectId(req.params.id) })
    res.status(200).json({ deleted: result.deletedCount })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/notifications', async (_req, res) => {
  try {
    const notifications = await db.collection("notifications")
      .find({})
      .sort({ createdAt: -1 })
      .toArray()
    res.status(200).json(notifications)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/notifications', async (req, res) => {
  try {
    const { senderRole, receiverRole, type, title, content } = req.body
    const newNotification = {
      senderRole,
      receiverRole,
      type,
      title,
      content,
      createdAt: new Date().toISOString()
    }
    const result = await db.collection("notifications").insertOne(newNotification)
    res.status(201).json({ _id: result.insertedId, ...newNotification })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.get('/api/attendance-stats', async (_req, res) => {
  try {
    // Đã chuyển dữ liệu sang tiếng Anh
    const stats = [
      { name: 'Present', value: 78, color: '#4CAF50' },
      { name: 'Late', value: 12, color: '#FFC107' },
      { name: 'Excused', value: 6, color: '#2196F3' },
      { name: 'Unexcused', value: 4, color: '#F44336' }
    ]
    res.status(200).json(stats)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

async function start() {
  await client.connect()
  console.log("Connected to MongoDB Atlas!")
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`))
}

start()