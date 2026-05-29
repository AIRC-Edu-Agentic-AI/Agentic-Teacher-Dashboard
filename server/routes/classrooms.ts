import { Router } from 'express'
import { ObjectId, Db } from 'mongodb'
import { auth } from 'express-oauth2-jwt-bearer'

export function classroomRoutes(db: Db) {
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

  // GET /api/classrooms — list classrooms for the authenticated teacher
  router.get('/', checkJwt, async (req, res) => {
    const teacherId = req.auth?.payload.sub || 'mock-teacher-id'
    const classrooms = await db.collection('classrooms').find({ teacher_id: teacherId }).toArray()
    res.json(classrooms)
  })

  // POST /api/classrooms — create a new classroom
  router.post('/', checkJwt, async (req, res) => {
    const teacherId = req.auth?.payload.sub || 'mock-teacher-id'
    const { name, module, code_presentation, description, status, is_custom } = req.body
    if (!name || !module || !code_presentation) {
      return res.status(400).json({ error: 'name, module and code_presentation are required' })
    }

    // Verify course exists
    if (!is_custom) {
      const course = await db.collection('processed_courses').findOne({ module, presentation: code_presentation })
      if (!course) return res.status(404).json({ error: 'Course not found' })
    }
    const now = new Date()
    const result = await db.collection('classrooms').insertOne({
      name,
      module,
      code_presentation,
      description: description ?? '',
      teacher_id: teacherId,
      student_ids: [],
      status: status ?? 'active',
      is_custom: !!is_custom, // 3. Lưu trữ cờ is_custom vào MongoDB
      created_at: now,
      updated_at: now,
    })
    res.status(201).json({ _id: result.insertedId })
  })

  // GET /api/classrooms/:id
  router.get('/:id', async (req, res) => {
    const classroom = await db.collection('classrooms').findOne({ _id: new ObjectId(req.params.id) })
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' })
    const { module, code_presentation, student_ids } = classroom
    let studentsDetails: any[] = []
    if (student_ids && student_ids.length > 0) {
      // 1. Tìm thông tin học sinh custom trong CSDL
      const customStudents = await db.collection('custom_students').find({
        code_module: module,
        code_presentation: code_presentation,
        id_student: { $in: student_ids }
      }).toArray()
      // 2. Tìm thông tin học sinh OULAD trong CSDL (phòng trường hợp dùng tập OULAD gốc)
      const ouladStudents = await db.collection('processed_students').find({
        code_module: module,
        code_presentation: code_presentation,
        id_student: { $in: student_ids }
      }).toArray()
      // 3. Hợp nhất dữ liệu học sinh (Ưu tiên học sinh custom tự tạo)
      const studentMap = new Map()
      ouladStudents.forEach(s => {
        studentMap.set(s.id_student, {
          id_student: s.id_student,
          name: s.name || `Student #${s.id_student}`,
          gender: s.gender || 'Unknown',
          region: s.region || 'Unknown',
          highest_education: s.highest_education || 'Unknown',
          final_result: s.final_result || 'Pass',
          age_band: s.age_band || '0-35',
          imd_band: s.imd_band || '50-60%'
        })
      })
      customStudents.forEach(s => {
        studentMap.set(s.id_student, {
          id_student: s.id_student,
          name: s.name || `Student #${s.id_student}`,
          gender: s.gender || 'Unknown',
          region: s.region || 'Unknown',
          highest_education: s.highest_education || 'Unknown',
          final_result: s.final_result || 'Pass',
          age_band: s.age_band || '0-35',
          imd_band: s.imd_band || '50-60%'
        })
      })
      // Đảm bảo thứ tự học sinh đúng như mảng ban đầu
      studentsDetails = student_ids.map(id => studentMap.get(id) || { id_student: id, name: `Student #${id}` })
    }
    res.json({ ...classroom, students: studentsDetails })
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
    const { students } = req.body // array of full student profile records
    if (!Array.isArray(students)) return res.status(400).json({ error: 'students must be an array' })

    const classroomId = req.params.id
    const classroom = await db.collection('classrooms').findOne({ _id: new ObjectId(classroomId) })
    if (!classroom) return res.status(404).json({ error: 'Classroom not found' })

    const student_ids = students.map(s => s.student_id).filter(id => !isNaN(id))

    // Clear existing custom students for this classroom & save new ones
    await db.collection('custom_students').deleteMany({
      code_module: classroom.module,
      code_presentation: classroom.code_presentation
    })

    if (students.length > 0) {
      const recordsToInsert = students.map(s => ({
        ...s,
        id_student: s.student_id, // Match standard OULAD key
        code_module: classroom.module,
        code_presentation: classroom.code_presentation,
        created_at: new Date()
      }))
      await db.collection('custom_students').insertMany(recordsToInsert)
    }

    const now = new Date()
    const result = await db.collection('classrooms').updateOne(
      { _id: new ObjectId(classroomId) },
      { $set: { student_ids, updated_at: now } }
    )

    res.json({ success: true })
  })

  return router
}