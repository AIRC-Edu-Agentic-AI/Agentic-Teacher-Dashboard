import { MongoClient } from 'mongodb'
import dotenv from 'dotenv'
import { PRESENTATION_ANCHORS, weekToDate } from '../src/shared/scheduleAnchors'

dotenv.config()

const uri = process.env.MONGODB_URI
if (!uri) { console.error('Missing MONGODB_URI'); process.exit(1) }

async function main() {
  const client = new MongoClient(uri!)
  await client.connect()
  const db = client.db(process.env.MONGODB_DB ?? 'oulad_db')
  const events = db.collection('schedule_events')

  // 1. Migrate legacy flat class docs ({ subject, classroom, date, type })
  const legacy = await db.collection('schedules').find({ subject: { $exists: true } }).toArray()
  let migrated = 0
  for (const doc of legacy) {
    await events.updateOne(
      { kind: 'class', title: doc.subject, date: new Date(doc.date).toISOString() },
      { $setOnInsert: {
        module: doc.module ?? 'AAA', presentation: doc.presentation ?? '2013J',
        kind: 'class', title: doc.subject, date: new Date(doc.date).toISOString(),
        week: null, classroom: doc.classroom ?? '', class_type: doc.type === 'Makeup' ? 'Makeup' : 'Regular',
        created_at: new Date().toISOString(),
      } },
      { upsert: true },
    )
    migrated++
  }

  // 2. Seed lecture events per course from the processed index
  const courses = await db.collection('processed_courses')
    .find({}, { projection: { module: 1, presentation: 1, num_weeks: 1 } }).toArray()
  let seeded = 0
  for (const c of courses) {
    if (!PRESENTATION_ANCHORS[c.presentation]) continue
    const weeks = c.num_weeks ?? 39
    for (let w = 1; w <= weeks; w++) {
      await events.updateOne(
        { module: c.module, presentation: c.presentation, kind: 'lecture', week: w },
        { $setOnInsert: {
          module: c.module, presentation: c.presentation, kind: 'lecture', week: w,
          title: `Lecture Week ${w}: ${c.module} core concepts`,
          date: weekToDate(c.presentation, w),
          materials_url: `https://lms.university.edu/${c.module}/week-${w}`,
          created_at: new Date().toISOString(),
        } },
        { upsert: true },
      )
      seeded++
    }
  }

  console.log(`Migrated ${migrated} class events; seeded up to ${seeded} lecture events.`)
  await client.close()
}

main().catch((e) => { console.error(e); process.exit(1) })
