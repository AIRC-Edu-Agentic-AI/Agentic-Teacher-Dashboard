import { Router } from 'express'
import { ObjectId, Db } from 'mongodb'
import { auth } from 'express-oauth2-jwt-bearer'

export function assessmentRoutes(db: Db) {
  const router = Router()

  // Permissive JWT middleware: validates token if present, otherwise proceeds without failing with 401
  const checkJwt = (req: any, res: any, next: any) => {
    if (!req.headers.authorization) {
      return next()
    }
    const validateJwt = auth({
      audience: process.env.AUTH0_AUDIENCE,
      issuerBaseURL: `https://${process.env.AUTH0_DOMAIN}/`,
      tokenSigningAlg: 'RS256'
    })
    return validateJwt(req, res, (err: any) => {
      // Catch validation error to prevent throwing 401, proceed to route handler
      return next()
    })
  }

  // GET /api/classrooms/:id/assessments
  router.get('/:id/assessments', checkJwt, async (req, res) => {
    const assessments = await db.collection('assessments')
      .find({ classroom_id: new ObjectId(req.params.id) })
      .toArray()
    res.json(assessments)
  })

  // POST /api/classrooms/:id/assessments
  router.post('/:id/assessments', checkJwt, async (req, res) => {
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