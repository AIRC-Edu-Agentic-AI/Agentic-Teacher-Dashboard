import { Router } from 'express'
import { ObjectId, Db } from 'mongodb'

export function assessmentRoutes(db: Db) {
  const router = Router()

  // GET /api/classrooms/:id/assessments
  router.get('/:id/assessments', async (req, res) => {
    const assessments = await db.collection('assessments')
      .find({ classroom_id: new ObjectId(req.params.id) })
      .toArray()
    res.json(assessments)
  })

  // POST /api/classrooms/:id/assessments
  router.post('/:id/assessments', async (req, res) => {
    const { name, weight, due_date, assessment_type } = req.body
    if (!name || !assessment_type) return res.status(400).json({ error: 'name and assessment_type are required' })

    const result = await db.collection('assessments').insertOne({
      classroom_id: new ObjectId(req.params.id),
      name,
      weight: weight ?? 0,
      due_date: due_date ? new Date(due_date) : null,
      assessment_type,
    })
    res.status(201).json({ _id: result.insertedId })
  })

  return router
}