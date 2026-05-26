import { Router } from 'express'
import { Db } from 'mongodb'

const DEFAULT_PREFERENCES = {
  theme: 'light',
  default_week: 1,
  students_per_page: 20,
}

export function profileRoutes(db: Db) {
  const router = Router()

  // GET /api/profile/preferences
  router.get('/preferences', async (req, res) => {
    const auth0Sub = req.auth?.payload.sub
    if (!auth0Sub) return res.status(401).json({ error: 'Unauthorized' })

    const user = await db.collection('users').findOne({ auth0_sub: auth0Sub })

    // Return stored preferences or defaults if user doesn't exist yet
    res.json(user?.preferences ?? DEFAULT_PREFERENCES)
  })

  // PATCH /api/profile/preferences
  router.patch('/preferences', async (req, res) => {
    const auth0Sub = req.auth?.payload.sub
    if (!auth0Sub) return res.status(401).json({ error: 'Unauthorized' })

    const { theme, default_week, students_per_page } = req.body

    // Validate fields if provided
    if (theme !== undefined && !['light', 'dark'].includes(theme)) {
      return res.status(400).json({ error: 'theme must be "light" or "dark"' })
    }
    if (default_week !== undefined && (typeof default_week !== 'number' || default_week < 1)) {
      return res.status(400).json({ error: 'default_week must be a positive number' })
    }
    if (students_per_page !== undefined && ![10, 20, 50].includes(students_per_page)) {
      return res.status(400).json({ error: 'students_per_page must be 10, 20, or 50' })
    }

    // Build partial update — only update provided fields
    const updates: Record<string, unknown> = {}
    if (theme !== undefined)            updates['preferences.theme'] = theme
    if (default_week !== undefined)     updates['preferences.default_week'] = default_week
    if (students_per_page !== undefined) updates['preferences.students_per_page'] = students_per_page

    const result = await db.collection('users').findOneAndUpdate(
      { auth0_sub: auth0Sub },
      { $set: updates },
      { upsert: true, returnDocument: 'after' }
    )

    res.json(result?.preferences ?? DEFAULT_PREFERENCES)
  })

  return router
}