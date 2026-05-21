import { Router } from 'express'
import { ObjectId, Db } from 'mongodb'

export function classroomRoutes(db: Db) {
  const router = Router()

  // GET /api/classrooms — list classrooms for the authenticated teacher
  router.get('/', async (req, res) => {
    const teacherId = req.auth?.payload.sub
    const classrooms = await db.collection('classrooms').find({ teacher_id: teacherId }).toArray()
    res.json(classrooms)
  })

  // POST /api/classrooms — create a new classroom
  router.post('/', async (req, res) => {
    const teacherId = req.auth?.payload.sub
    const { name, module, code_presentation, description, status } = req.body

    if (!name || !module || !code_presentation) {
      return res.status(400).json({ error: 'name, module and code_presentation are required' })
    }

    // Verify course exists
    const course = await db.collection('processed_courses').findOne({ module, presentation: code_presentation })
    if (!course) return res.status(404).json({ error: 'Course not found' })

    const now = new Date()
    const result = await db.collection('classrooms').insertOne({
      name,
      module,
      code_presentation,
      description: description ?? '',
      teacher_id: teacherId,
      student_ids: [],
      status: status ?? 'active',
      created_at: now,
      updated_at: now,
    })

    res.status(201).json({ _id: result.insertedId })
  })

  // GET /api/classrooms/:id
  router.get('/:id', async (req, res) => {
    const classroom = await db.collection('classrooms').findOne({ _id: new ObjectId(req.params.id) })
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' })
    res.json(classroom)
  })

  // PUT /api/classrooms/:id
  router.put('/:id', async (req, res) => {
    const { name, description, status } = req.body
    const now = new Date()
    const result = await db.collection('classrooms').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { name, description, status, updated_at: now } }
    )
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Classroom not found' })
    res.json({ success: true })
  })

  // DELETE /api/classrooms/:id
  router.delete('/:id', async (req, res) => {
    const result = await db.collection('classrooms').deleteOne({ _id: new ObjectId(req.params.id) })
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Classroom not found' })
    res.status(204).send()
  })

  // POST /api/classrooms/:id/students — import students via CSV
  router.post('/:id/students', async (req, res) => {
    const { student_ids } = req.body // array of numbers from parsed CSV
    if (!Array.isArray(student_ids)) return res.status(400).json({ error: 'student_ids must be an array' })

    const now = new Date()
    const result = await db.collection('classrooms').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $addToSet: { student_ids: { $each: student_ids } }, $set: { updated_at: now } }
    )
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Classroom not found' })
    res.json({ success: true })
  })

  return router
}