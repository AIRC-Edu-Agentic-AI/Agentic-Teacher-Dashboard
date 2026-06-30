# Schedule & Tasks Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two conflicting schedule systems with one unified `schedule_events` model, expose it through a Weekly Schedule calendar and a home page (rule-based suggestions + to-do list), all manually usable with no agent involved.

**Architecture:** Hexagonal — Express owns a single `schedule_events` Mongo collection behind a REST resource; the client talks to it through a new `ScheduleService` port + `ApiScheduleAdapter` registered in the DI container. Pure logic (date math, validation, suggestion rules) lives in small tested modules; React views (calendar, home) consume the port and the existing OULAD `DataService`.

**Tech Stack:** TypeScript (strict), React 18, MUI v5, Zustand (`contextStore`), Express 5 + MongoDB driver 7 (run via `tsx`), Vite 5, Vitest (added in Task 1).

## Global Constraints

- TypeScript strict mode; no `any` in new client code except where mirroring existing server handlers (`error: any` is the established server pattern).
- Client API base URL: `import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api'` (exact fallback string).
- All client API calls MUST throw on non-2xx responses — no silent failures (this is a named regression to prevent).
- MUI components only for new UI (no raw HTML tables / inline-style-only components).
- Domain time-series arrays are indexed `0 = week 1`; course week `W` is array index `W - 1`.
- Mongo `_id` is serialized to a hex string by `res.json()`; the client treats `ScheduleEvent._id` as `string`.
- Collection name is exactly `schedule_events`. The legacy `schedules` collection is left untouched (not dropped).
- Commit after every task with the message shown in its final step.

---

## File Structure

**Create:**
- `vitest.config.ts` — Vitest config (jsdom env).
- `src/shared/scheduleAnchors.ts` — `PRESENTATION_ANCHORS`, `weekToDate`, `weekRange`.
- `src/shared/scheduleAnchors.test.ts` — tests for date math.
- `src/shared/scheduleEventValidation.ts` — `validateScheduleEvent` (shared by server + tests).
- `src/shared/scheduleEventValidation.test.ts` — validation tests.
- `src/ports/ScheduleService.ts` — port interface.
- `src/adapters/ApiScheduleAdapter.ts` — REST adapter.
- `src/adapters/ApiScheduleAdapter.test.ts` — mocked-fetch tests.
- `src/modules/schedule/eventDisplay.ts` — `eventBadge` (shared by calendar + todo).
- `src/modules/schedule/signals/suggestionRules.ts` — deterministic signal rules.
- `src/modules/schedule/signals/suggestionRules.test.ts` — rule tests.
- `src/modules/schedule/components/ScheduleEventDialog.tsx` — create/edit dialog.
- `src/modules/schedule/views/WeeklyScheduleView.tsx` — calendar view.
- `src/modules/home/components/SuggestionsPanel.tsx` — suggestion cards.
- `src/modules/home/components/TodoList.tsx` — to-do list.
- `src/modules/home/views/HomeView.tsx` — landing page.
- `scripts/migrate-schedule-events.ts` — migration + lecture seeding.

**Modify:**
- `package.json` — add `vitest` devDep + `test` script.
- `src/types/domain.ts` — append `ScheduleEvent` types.
- `server/index.ts` — replace `/api/schedules*` routes with `/api/schedule-events` CRUD.
- `src/di/container.ts` — register `scheduleService`.
- `src/App.tsx` — Home at `/`, overview at `/overview`, schedule at `/schedule`.
- `src/modules/registry.tsx` — nav entries (Home, Weekly Schedule, Overview).
- `src/modules/class/views/ClassView.tsx` — remove `<ScheduleCrud />`.

**Delete (in Task 7, after migration verified):**
- `src/modules/class/components/ScheduleCrud.tsx`
- `src/modules/dashboard/components/CourseSchedule.tsx`

---

## Task 1: Test tooling + domain types + date math

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Modify: `src/types/domain.ts` (append at end)
- Create: `src/shared/scheduleAnchors.ts`
- Test: `src/shared/scheduleAnchors.test.ts`

**Interfaces:**
- Produces: `ScheduleEvent`, `ScheduleEventKind`, `ClassType`, `TaskSource`, `TaskStatus` (types); `PRESENTATION_ANCHORS: Record<string,string>`; `weekToDate(presentation: string, week: number): string` (ISO); `weekRange(presentation: string, week: number): { start: string; end: string }`.

- [ ] **Step 1: Install Vitest + jsdom**

Run:
```bash
npm install -D vitest@^2 jsdom@^25
```
Expected: packages added to devDependencies, no errors. (`jsdom` backs the test environment; component tests are not in scope — UI tasks are verified manually.)

- [ ] **Step 2: Add the `test` script to `package.json`**

In the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
```

- [ ] **Step 4: Append `ScheduleEvent` types to `src/types/domain.ts`**

Add at the end of the file:
```ts
// ─── Schedule events (classes / lectures / tasks) ────────────────────────────

export type ScheduleEventKind = 'class' | 'lecture' | 'task'
export type ClassType = 'Regular' | 'Makeup'
export type TaskSource = 'suggestion' | 'intervention' | 'manual'
export type TaskStatus = 'open' | 'done' | 'dismissed'

export interface ScheduleEvent {
  _id?: string
  module: string
  presentation: string
  kind: ScheduleEventKind
  title: string
  date: string            // ISO datetime — the calendar axis
  week: number | null     // course week (lectures); null otherwise

  classroom?: string
  class_type?: ClassType

  materials_url?: string

  source?: TaskSource
  student_id?: number | null
  status?: TaskStatus
  linked_notification_id?: string | null

  created_at: string
}
```

- [ ] **Step 5: Write the failing test `src/shared/scheduleAnchors.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { weekToDate, weekRange } from './scheduleAnchors'

describe('weekToDate', () => {
  it('returns the anchor date for week 1', () => {
    expect(weekToDate('2013J', 1)).toBe('2013-10-07T00:00:00.000Z')
  })
  it('adds 7 days per week', () => {
    expect(weekToDate('2013J', 2)).toBe('2013-10-14T00:00:00.000Z')
    expect(weekToDate('2014J', 3)).toBe('2014-10-20T00:00:00.000Z')
  })
  it('throws for an unknown presentation', () => {
    expect(() => weekToDate('9999X', 1)).toThrow(/anchor/i)
  })
})

describe('weekRange', () => {
  it('spans Monday to the next Monday', () => {
    expect(weekRange('2013J', 1)).toEqual({
      start: '2013-10-07T00:00:00.000Z',
      end: '2013-10-14T00:00:00.000Z',
    })
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run src/shared/scheduleAnchors.test.ts`
Expected: FAIL — cannot resolve `./scheduleAnchors`.

- [ ] **Step 7: Implement `src/shared/scheduleAnchors.ts`**

```ts
// Per-presentation anchor start date (Monday of course week 1).
// Demo approximations for the OULAD presentation codes.
export const PRESENTATION_ANCHORS: Record<string, string> = {
  '2013B': '2013-02-04',
  '2013J': '2013-10-07',
  '2014B': '2014-02-03',
  '2014J': '2014-10-06',
}

const DAY_MS = 24 * 60 * 60 * 1000

export function weekToDate(presentation: string, week: number): string {
  const anchor = PRESENTATION_ANCHORS[presentation]
  if (!anchor) throw new Error(`No anchor date for presentation ${presentation}`)
  const start = new Date(`${anchor}T00:00:00.000Z`).getTime()
  return new Date(start + (week - 1) * 7 * DAY_MS).toISOString()
}

export function weekRange(presentation: string, week: number): { start: string; end: string } {
  const start = weekToDate(presentation, week)
  const end = new Date(new Date(start).getTime() + 7 * DAY_MS).toISOString()
  return { start, end }
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npx vitest run src/shared/scheduleAnchors.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/types/domain.ts src/shared/scheduleAnchors.ts src/shared/scheduleAnchors.test.ts
git commit -m "feat: add schedule_events types, date anchors, and Vitest tooling"
```

---

## Task 2: Server `schedule_events` resource + shared validation

**Files:**
- Create: `src/shared/scheduleEventValidation.ts`
- Test: `src/shared/scheduleEventValidation.test.ts`
- Modify: `server/index.ts` (replace lines `78`–`117`, the four `/api/schedules*` handlers, and remove the per-course `/api/schedules/:module/:presentation` handlers around lines `167`–`186`)

**Interfaces:**
- Consumes: `ScheduleEvent` (Task 1).
- Produces: `validateScheduleEvent(e: Partial<ScheduleEvent>): string[]` (empty array = valid); REST routes `GET/POST /api/schedule-events`, `PATCH/DELETE /api/schedule-events/:id`.

- [ ] **Step 1: Write the failing test `src/shared/scheduleEventValidation.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { validateScheduleEvent } from './scheduleEventValidation'

describe('validateScheduleEvent', () => {
  const base = { module: 'AAA', presentation: '2013J', title: 'x', date: '2013-10-07T00:00:00.000Z' }

  it('passes a valid class', () => {
    expect(validateScheduleEvent({ ...base, kind: 'class', classroom: '204', class_type: 'Regular' })).toEqual([])
  })
  it('flags missing core fields', () => {
    expect(validateScheduleEvent({ kind: 'lecture' })).toEqual(
      expect.arrayContaining(['Missing required field: module', 'Missing required field: title']),
    )
  })
  it('requires classroom and class_type for a class', () => {
    const errs = validateScheduleEvent({ ...base, kind: 'class' })
    expect(errs).toContain('class requires classroom')
    expect(errs).toContain('class requires class_type')
  })
  it('requires source and status for a task', () => {
    const errs = validateScheduleEvent({ ...base, kind: 'task' })
    expect(errs).toContain('task requires source')
    expect(errs).toContain('task requires status')
  })
  it('rejects an unknown kind', () => {
    expect(validateScheduleEvent({ ...base, kind: 'party' as never })).toContain('Invalid kind: party')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/scheduleEventValidation.test.ts`
Expected: FAIL — cannot resolve `./scheduleEventValidation`.

- [ ] **Step 3: Implement `src/shared/scheduleEventValidation.ts`**

```ts
import type { ScheduleEvent } from '../types/domain'

const KINDS = ['class', 'lecture', 'task']

export function validateScheduleEvent(e: Partial<ScheduleEvent>): string[] {
  const errors: string[] = []
  for (const field of ['module', 'presentation', 'kind', 'title', 'date'] as const) {
    if (!e[field]) errors.push(`Missing required field: ${field}`)
  }
  if (e.kind && !KINDS.includes(e.kind)) errors.push(`Invalid kind: ${e.kind}`)
  if (e.kind === 'class') {
    if (!e.classroom) errors.push('class requires classroom')
    if (!e.class_type) errors.push('class requires class_type')
  }
  if (e.kind === 'task') {
    if (!e.source) errors.push('task requires source')
    if (!e.status) errors.push('task requires status')
  }
  return errors
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/shared/scheduleEventValidation.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Replace the schedule routes in `server/index.ts`**

Add this import at the top of `server/index.ts` (after the existing imports):
```ts
import { validateScheduleEvent } from '../src/shared/scheduleEventValidation'
```

Delete the four `app.*('/api/schedules'...)` handlers (the block beginning `app.get('/api/schedules', ...)` through the `app.delete('/api/schedules/:id', ...)` handler) **and** the two per-course handlers (`app.get('/api/schedules/:module/:presentation', ...)` and `app.post('/api/schedules/:module/:presentation', ...)`). Replace them with:

```ts
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
```

- [ ] **Step 6: Verify the server boots and the route responds**

Run (in one shell): `npm run server`
Then in another shell:
```bash
curl -s "http://localhost:8000/api/schedule-events?module=AAA&presentation=2013J"
```
Expected: `[]` (or existing events) with HTTP 200, and the server logs `Connected to MongoDB Atlas!`. Stop the server after verifying.

- [ ] **Step 7: Commit**

```bash
git add src/shared/scheduleEventValidation.ts src/shared/scheduleEventValidation.test.ts server/index.ts
git commit -m "feat: replace schedule routes with unified /api/schedule-events resource"
```

---

## Task 3: ScheduleService port + ApiScheduleAdapter + DI

**Files:**
- Create: `src/ports/ScheduleService.ts`
- Create: `src/adapters/ApiScheduleAdapter.ts`
- Test: `src/adapters/ApiScheduleAdapter.test.ts`
- Modify: `src/di/container.ts`

**Interfaces:**
- Consumes: `ScheduleEvent`, `ScheduleEventKind` (Task 1).
- Produces: `ScheduleService` interface; `ApiScheduleAdapter` class; `container.scheduleService: ScheduleService`.

- [ ] **Step 1: Create the port `src/ports/ScheduleService.ts`**

```ts
import type { ScheduleEvent, ScheduleEventKind } from '../types/domain'

export interface ScheduleService {
  list(module: string, presentation: string, kind?: ScheduleEventKind): Promise<ScheduleEvent[]>
  create(event: Omit<ScheduleEvent, '_id' | 'created_at'>): Promise<ScheduleEvent>
  update(id: string, patch: Partial<ScheduleEvent>): Promise<ScheduleEvent>
  remove(id: string): Promise<void>
}
```

- [ ] **Step 2: Write the failing test `src/adapters/ApiScheduleAdapter.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiScheduleAdapter } from './ApiScheduleAdapter'

const adapter = new ApiScheduleAdapter()

beforeEach(() => { vi.restoreAllMocks() })

describe('ApiScheduleAdapter', () => {
  it('lists events for a course', async () => {
    const events = [{ _id: '1', module: 'AAA', presentation: '2013J', kind: 'class' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => events }))
    const result = await adapter.list('AAA', '2013J')
    expect(result).toEqual(events)
    expect((fetch as any).mock.calls[0][0]).toContain('/schedule-events?module=AAA&presentation=2013J')
  })

  it('throws with server detail on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400, json: async () => ({ error: 'task requires status' }),
    }))
    await expect(adapter.create({ module: 'AAA', presentation: '2013J', kind: 'task', title: 't', date: 'd', week: null } as any))
      .rejects.toThrow(/400: task requires status/)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/adapters/ApiScheduleAdapter.test.ts`
Expected: FAIL — cannot resolve `./ApiScheduleAdapter`.

- [ ] **Step 4: Implement `src/adapters/ApiScheduleAdapter.ts`**

```ts
import type { ScheduleEvent, ScheduleEventKind } from '../types/domain'
import type { ScheduleService } from '../ports/ScheduleService'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.error ?? '' } catch { /* non-JSON body */ }
    throw new Error(`Schedule API ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  return res.json() as Promise<T>
}

export class ApiScheduleAdapter implements ScheduleService {
  async list(module: string, presentation: string, kind?: ScheduleEventKind): Promise<ScheduleEvent[]> {
    const params = new URLSearchParams({ module, presentation })
    if (kind) params.set('kind', kind)
    return handle<ScheduleEvent[]>(await fetch(`${API_BASE}/schedule-events?${params.toString()}`))
  }

  async create(event: Omit<ScheduleEvent, '_id' | 'created_at'>): Promise<ScheduleEvent> {
    return handle<ScheduleEvent>(await fetch(`${API_BASE}/schedule-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }))
  }

  async update(id: string, patch: Partial<ScheduleEvent>): Promise<ScheduleEvent> {
    return handle<ScheduleEvent>(await fetch(`${API_BASE}/schedule-events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }))
  }

  async remove(id: string): Promise<void> {
    await handle<{ deleted: number }>(await fetch(`${API_BASE}/schedule-events/${id}`, { method: 'DELETE' }))
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/adapters/ApiScheduleAdapter.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Register the service in `src/di/container.ts`**

Add the imports:
```ts
import { ApiScheduleAdapter } from '../adapters/ApiScheduleAdapter'
import type { ScheduleService } from '../ports/ScheduleService'
```
Add `scheduleService` to the container type and value:
```ts
export const container: {
  dataService: DataService
  agentService: AgentService
  masteryService: MasteryService
  scheduleService: ScheduleService
} = {
  dataService: new ProcessedDataAdapter(),
  agentService: new ClaudeAgentAdapter(),
  masteryService: new MockMasteryAdapter(),
  scheduleService: new ApiScheduleAdapter(),
}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/ports/ScheduleService.ts src/adapters/ApiScheduleAdapter.ts src/adapters/ApiScheduleAdapter.test.ts src/di/container.ts
git commit -m "feat: add ScheduleService port, ApiScheduleAdapter, and DI registration"
```

---

## Task 4: Deterministic suggestion rules + event display helper

**Files:**
- Create: `src/modules/schedule/eventDisplay.ts`
- Create: `src/modules/schedule/signals/suggestionRules.ts`
- Test: `src/modules/schedule/signals/suggestionRules.test.ts`

**Interfaces:**
- Consumes: `ProcessedCourse`, `StudentProfile`, `ScheduleEvent` (domain).
- Produces:
  - `eventBadge(e: ScheduleEvent): { emoji: string; label: string; color: string }`
  - `interface SuggestionCard { id: string; kind: 'tier-escalation' | 'engagement-drop' | 'assessment-risk'; title: string; detail: string; defaultTask: { title: string; student_id: number | null } }`
  - `computeSuggestions(course: ProcessedCourse, week: number): SuggestionCard[]`

- [ ] **Step 1: Create `src/modules/schedule/eventDisplay.ts`**

```ts
import type { ScheduleEvent } from '../../types/domain'

export function eventBadge(e: ScheduleEvent): { emoji: string; label: string; color: string } {
  if (e.kind === 'class') return { emoji: '📅', label: e.class_type ?? 'Class', color: '#1976d2' }
  if (e.kind === 'lecture') return { emoji: '📖', label: 'Lecture', color: '#6a1b9a' }
  if (e.source === 'intervention') return { emoji: '🎯', label: 'Intervention', color: '#c62828' }
  if (e.source === 'suggestion') return { emoji: '💡', label: 'Suggestion', color: '#ef6c00' }
  return { emoji: '📝', label: 'Task', color: '#555555' }
}
```

- [ ] **Step 2: Write the failing test `src/modules/schedule/signals/suggestionRules.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeSuggestions } from './suggestionRules'
import type { ProcessedCourse, StudentProfile } from '../../../types/domain'

function student(id: number, over: Partial<StudentProfile>): StudentProfile {
  return {
    id_student: id, gender: 'M', region: 'r', highest_education: 'e', imd_band: 'b',
    age_band: 'a', num_of_prev_attempts: 0, studied_credits: 60, disability: false,
    final_result: 'Pass', date_registration: -30, date_unregistration: null,
    weekly_clicks: [], decayed_engagement: [], assessments: [],
    risk_by_week: [], tier_by_week: [], lstm_trajectories: null,
    ...over,
  }
}

// week 3 -> index 2; week 2 -> index 1
const course: ProcessedCourse = {
  module: 'AAA', presentation: '2013J', num_weeks: 39,
  cohort_p75_decayed: [0, 0, 50],
  students: [
    // escalated tier 1 -> 3 at week 3, and engagement below cohort p75
    student(11, { tier_by_week: [1, 1, 3], decayed_engagement: [80, 80, 10] }),
    // steady, healthy
    student(12, { tier_by_week: [1, 1, 1], decayed_engagement: [80, 80, 90] }),
  ],
}

describe('computeSuggestions', () => {
  it('flags a tier escalation at the current week', () => {
    const cards = computeSuggestions(course, 3)
    const tier = cards.find(c => c.kind === 'tier-escalation')
    expect(tier).toBeDefined()
    expect(tier!.detail).toMatch(/1 student/)
  })

  it('flags an engagement drop for the dropping student only', () => {
    const cards = computeSuggestions(course, 3)
    const drops = cards.filter(c => c.kind === 'engagement-drop')
    expect(drops).toHaveLength(1)
    expect(drops[0].defaultTask.student_id).toBe(11)
  })

  it('returns no cards when nothing is wrong', () => {
    const calm: ProcessedCourse = { ...course, students: [course.students[1]] }
    expect(computeSuggestions(calm, 3)).toEqual([])
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/modules/schedule/signals/suggestionRules.test.ts`
Expected: FAIL — cannot resolve `./suggestionRules`.

- [ ] **Step 4: Implement `src/modules/schedule/signals/suggestionRules.ts`**

```ts
import type { ProcessedCourse, StudentProfile } from '../../../types/domain'

export interface SuggestionCard {
  id: string
  kind: 'tier-escalation' | 'engagement-drop' | 'assessment-risk'
  title: string
  detail: string
  defaultTask: { title: string; student_id: number | null }
}

// Domain arrays are 0-indexed at week 1, so week W is index W - 1.
const at = <T>(arr: T[], week: number): T | undefined => arr[week - 1]

const MAX_ENGAGEMENT_CARDS = 3
const ENGAGEMENT_DROP_RATIO = 0.5 // current < 50% of trailing average

function tierEscalation(course: ProcessedCourse, week: number): SuggestionCard[] {
  if (week < 2) return []
  const escalated = course.students.filter((s) => {
    const prev = at(s.tier_by_week, week - 1)
    const cur = at(s.tier_by_week, week)
    return prev != null && cur != null && cur > prev
  })
  if (escalated.length === 0) return []
  return [{
    id: `tier-escalation-w${week}`,
    kind: 'tier-escalation',
    title: 'Risk tier escalations this week',
    detail: `${escalated.length} student${escalated.length === 1 ? '' : 's'} escalated to a higher risk tier.`,
    defaultTask: { title: `Review ${escalated.length} tier escalation(s) (week ${week})`, student_id: null },
  }]
}

function engagementDrop(course: ProcessedCourse, week: number): SuggestionCard[] {
  if (week < 2) return []
  const p75 = at(course.cohort_p75_decayed, week) ?? Infinity
  const dropped: { s: StudentProfile; cur: number }[] = []
  for (const s of course.students) {
    const cur = at(s.decayed_engagement, week)
    if (cur == null) continue
    const history = s.decayed_engagement.slice(0, week - 1).filter((v): v is number => v != null)
    if (history.length === 0) continue
    const avg = history.reduce((a, b) => a + b, 0) / history.length
    if (cur < avg * ENGAGEMENT_DROP_RATIO && cur < p75) dropped.push({ s, cur })
  }
  dropped.sort((a, b) => a.cur - b.cur)
  return dropped.slice(0, MAX_ENGAGEMENT_CARDS).map(({ s }) => ({
    id: `engagement-drop-${s.id_student}-w${week}`,
    kind: 'engagement-drop' as const,
    title: `Student #${s.id_student} engagement dropped`,
    detail: `Engagement fell sharply and is below the cohort's 75th percentile.`,
    defaultTask: { title: `Check in with student #${s.id_student}`, student_id: s.id_student },
  }))
}

function assessmentRisk(course: ProcessedCourse, week: number): SuggestionCard[] {
  // Day offset of the current week (course day numbering), 7 days per week.
  const weekDay = (week - 1) * 7
  const cards: SuggestionCard[] = []
  const seen = new Set<number>()
  for (const s of course.students) {
    for (const a of s.assessments) {
      if (a.date_due == null || seen.has(a.id_assessment)) continue
      const daysUntil = a.date_due - weekDay
      if (daysUntil < 0 || daysUntil > 7) continue
      seen.add(a.id_assessment)
      const notSubmitted = course.students.filter((st) =>
        st.assessments.some((x) => x.id_assessment === a.id_assessment && x.date_submitted == null)).length
      if (notSubmitted === 0) continue
      cards.push({
        id: `assessment-risk-${a.id_assessment}-w${week}`,
        kind: 'assessment-risk',
        title: `Assessment due soon`,
        detail: `Assessment ${a.id_assessment} is due within ${daysUntil} day(s); ${notSubmitted} not submitted.`,
        defaultTask: { title: `Chase ${notSubmitted} non-submitters for assessment ${a.id_assessment}`, student_id: null },
      })
    }
  }
  return cards
}

export function computeSuggestions(course: ProcessedCourse, week: number): SuggestionCard[] {
  return [
    ...tierEscalation(course, week),
    ...engagementDrop(course, week),
    ...assessmentRisk(course, week),
  ]
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/modules/schedule/signals/suggestionRules.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/schedule/eventDisplay.ts src/modules/schedule/signals/suggestionRules.ts src/modules/schedule/signals/suggestionRules.test.ts
git commit -m "feat: add deterministic suggestion rules and event badge helper"
```

---

## Task 5: Weekly Schedule calendar view

**Files:**
- Create: `src/modules/schedule/components/ScheduleEventDialog.tsx`
- Create: `src/modules/schedule/views/WeeklyScheduleView.tsx`
- Modify: `src/App.tsx` (add route `/schedule`)
- Modify: `src/modules/registry.tsx` (add nav entry)
- Modify: `src/modules/class/views/ClassView.tsx` (remove `<ScheduleCrud />` usage + import)

**Interfaces:**
- Consumes: `container.scheduleService` (Task 3), `weekRange` (Task 1), `eventBadge` (Task 4), `useContextStore` (`selectedModule`, `selectedPresentation`, `currentWeek`), `ScheduleEvent` types.
- Produces: `WeeklyScheduleView` (default export of view); `ScheduleEventDialog` component.

> This task is verified manually (no component test harness in this codebase). Each step still ends testable via the browser.

- [ ] **Step 1: Create the create/edit dialog `src/modules/schedule/components/ScheduleEventDialog.tsx`**

```tsx
import { useEffect, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  MenuItem, Stack,
} from '@mui/material'
import type { ScheduleEvent, ScheduleEventKind, ClassType } from '../../../types/domain'

export interface ScheduleEventDialogProps {
  open: boolean
  initial?: Partial<ScheduleEvent>
  defaultDate: string                 // ISO, used when creating
  onClose: () => void
  onSave: (data: Omit<ScheduleEvent, '_id' | 'created_at'>) => Promise<void>
  onDelete?: () => Promise<void>      // present only when editing
}

const KINDS: ScheduleEventKind[] = ['class', 'lecture', 'task']
const CLASS_TYPES: ClassType[] = ['Regular', 'Makeup']

export function ScheduleEventDialog(props: ScheduleEventDialogProps) {
  const { open, initial, defaultDate, onClose, onSave, onDelete } = props
  const [kind, setKind] = useState<ScheduleEventKind>('class')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate.slice(0, 10))
  const [classroom, setClassroom] = useState('')
  const [classType, setClassType] = useState<ClassType>('Regular')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setKind((initial?.kind as ScheduleEventKind) ?? 'class')
    setTitle(initial?.title ?? '')
    setDate((initial?.date ?? defaultDate).slice(0, 10))
    setClassroom(initial?.classroom ?? '')
    setClassType((initial?.class_type as ClassType) ?? 'Regular')
    setError(null)
  }, [open, initial, defaultDate])

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const data: Omit<ScheduleEvent, '_id' | 'created_at'> = {
        module: initial!.module!, presentation: initial!.presentation!,
        kind, title: title.trim(), date: new Date(`${date}T09:00:00.000Z`).toISOString(),
        week: initial?.week ?? null,
        ...(kind === 'class' ? { classroom: classroom.trim(), class_type: classType } : {}),
        ...(kind === 'task' ? { source: initial?.source ?? 'manual', status: initial?.status ?? 'open', student_id: initial?.student_id ?? null } : {}),
      }
      await onSave(data)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial?._id ? 'Edit event' : 'Add event'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Kind" value={kind} onChange={(e) => setKind(e.target.value as ScheduleEventKind)} disabled={!!initial?._id}>
            {KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </TextField>
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          {kind === 'class' && (
            <>
              <TextField label="Classroom" value={classroom} onChange={(e) => setClassroom(e.target.value)} />
              <TextField select label="Class type" value={classType} onChange={(e) => setClassType(e.target.value as ClassType)}>
                {CLASS_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </>
          )}
          {error && <div style={{ color: '#c62828', fontSize: 13 }}>{error}</div>}
        </Stack>
      </DialogContent>
      <DialogActions>
        {onDelete && <Button color="error" onClick={onDelete} sx={{ mr: 'auto' }}>Delete</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving || !title.trim()} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
```

- [ ] **Step 2: Create the calendar `src/modules/schedule/views/WeeklyScheduleView.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Typography, Paper, Button, Chip, Stack, Alert } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { weekRange } from '../../../shared/scheduleAnchors'
import { eventBadge } from '../eventDisplay'
import { ScheduleEventDialog } from '../components/ScheduleEventDialog'
import type { ScheduleEvent } from '../../../types/domain'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeeklyScheduleView() {
  const { selectedModule, selectedPresentation, currentWeek } = useContextStore()
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleEvent | null>(null)
  const [addDate, setAddDate] = useState<string>('')

  const range = useMemo(() => {
    if (!selectedPresentation) return null
    try { return weekRange(selectedPresentation, currentWeek) } catch { return null }
  }, [selectedPresentation, currentWeek])

  const load = useCallback(async () => {
    if (!selectedModule || !selectedPresentation) return
    setError(null)
    try {
      const all = await container.scheduleService.list(selectedModule, selectedPresentation)
      setEvents(all)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule')
    }
  }, [selectedModule, selectedPresentation])

  useEffect(() => { load() }, [load])

  const days = useMemo(() => {
    if (!range) return []
    const start = new Date(range.start).getTime()
    return DAY_LABELS.map((label, i) => {
      const dayStart = start + i * DAY_MS
      const dayEnd = dayStart + DAY_MS
      const dayEvents = events.filter((e) => {
        const t = new Date(e.date).getTime()
        return t >= dayStart && t < dayEnd
      })
      return { label, iso: new Date(dayStart).toISOString(), date: new Date(dayStart), events: dayEvents }
    })
  }, [range, events])

  async function handleSave(data: Omit<ScheduleEvent, '_id' | 'created_at'>) {
    if (editing?._id) await container.scheduleService.update(editing._id, data)
    else await container.scheduleService.create(data)
    await load()
  }

  async function handleDelete() {
    if (!editing?._id) return
    await container.scheduleService.remove(editing._id)
    setDialogOpen(false); setEditing(null)
    await load()
  }

  async function toggleStatus(e: ScheduleEvent, status: 'done' | 'dismissed') {
    if (!e._id) return
    await container.scheduleService.update(e._id, { status })
    await load()
  }

  if (!selectedModule || !selectedPresentation) {
    return <Box sx={{ p: 3 }}><Alert severity="info">Select a module and presentation to view the schedule.</Alert></Box>
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Weekly Schedule · Week {currentWeek}</Typography>
        <Button startIcon={<AddIcon />} variant="contained" sx={{ ml: 'auto' }}
          onClick={() => { setEditing(null); setAddDate(range?.start ?? new Date().toISOString()); setDialogOpen(true) }}>
          Add event
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {days.map((day) => (
          <Paper key={day.label} variant="outlined" sx={{ p: 1, minHeight: 160 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>
              {day.label} {day.date.getUTCDate()}/{day.date.getUTCMonth() + 1}
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {day.events.map((e) => {
                const badge = eventBadge(e)
                const done = e.kind === 'task' && e.status !== 'open'
                return (
                  <Paper key={e._id} onClick={() => { setEditing(e); setDialogOpen(true) }}
                    sx={{ p: 0.75, cursor: 'pointer', borderLeft: `3px solid ${badge.color}`, opacity: done ? 0.5 : 1 }}>
                    <Typography sx={{ fontSize: 11 }}>{badge.emoji} {e.title}</Typography>
                    <Chip label={badge.label} size="small" sx={{ height: 16, fontSize: 9, mt: 0.25 }} />
                    {e.kind === 'task' && e.status === 'open' && (
                      <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                        <Button size="small" sx={{ fontSize: 9, minWidth: 0 }} onClick={(ev) => { ev.stopPropagation(); toggleStatus(e, 'done') }}>Done</Button>
                        <Button size="small" sx={{ fontSize: 9, minWidth: 0 }} onClick={(ev) => { ev.stopPropagation(); toggleStatus(e, 'dismissed') }}>Dismiss</Button>
                      </Box>
                    )}
                  </Paper>
                )
              })}
            </Stack>
          </Paper>
        ))}
      </Box>

      <ScheduleEventDialog
        open={dialogOpen}
        initial={editing ?? { module: selectedModule, presentation: selectedPresentation }}
        defaultDate={editing?.date ?? addDate}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        onSave={handleSave}
        onDelete={editing?._id ? handleDelete : undefined}
      />
    </Box>
  )
}
```

- [ ] **Step 3: Add the `/schedule` route in `src/App.tsx`**

Add the import near the other view imports:
```tsx
import { WeeklyScheduleView } from './modules/schedule/views/WeeklyScheduleView'
```
Add the route inside `<Routes>` (alongside the existing routes):
```tsx
<Route path="/schedule" element={<WeeklyScheduleView />} />
```

- [ ] **Step 4: Add the nav entry in `src/modules/registry.tsx`**

Add the import:
```tsx
import CalendarIcon from '@mui/icons-material/CalendarMonthRounded'
```
Add to `moduleRegistry` (after the `class` entry):
```tsx
  {
    id: 'schedule',
    label: 'Weekly Schedule',
    path: '/schedule',
    icon: <CalendarIcon fontSize="small" />,
  },
```

- [ ] **Step 5: Remove `ScheduleCrud` from `src/modules/class/views/ClassView.tsx`**

Delete the `import ScheduleCrud from '../components/ScheduleCrud';` line and the `<ScheduleCrud />` element. Leave `AttendanceDashboard` and `NotificationManager` intact.

- [ ] **Step 6: Manual verification**

Run `npm run server` and `npm run dev` (two shells). In the browser:
1. Pick a module/presentation in the context bar; open **Weekly Schedule**.
2. Click **Add event** → create a `class` (e.g. "Lecture 1", classroom 204) → it appears in the correct day column.
3. Click the event → edit the title → Save → it updates. Click **Delete** → it disappears.
4. With the API server **stopped**, click Add/Save → a red error message shows (no silent failure).
Type-check: `npx tsc --noEmit` → no errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/schedule/ src/App.tsx src/modules/registry.tsx src/modules/class/views/ClassView.tsx
git commit -m "feat: add Weekly Schedule calendar view and route, drop ScheduleCrud usage"
```

---

## Task 6: Home page (suggestions + to-do list)

**Files:**
- Create: `src/modules/home/components/SuggestionsPanel.tsx`
- Create: `src/modules/home/components/TodoList.tsx`
- Create: `src/modules/home/views/HomeView.tsx`
- Modify: `src/App.tsx` (Home at `/`, overview at `/overview`)
- Modify: `src/modules/registry.tsx` (Home entry; relabel dashboard to `/overview`)

**Interfaces:**
- Consumes: `container.dataService`, `container.scheduleService`; `computeSuggestions`, `SuggestionCard` (Task 4); `weekToDate` (Task 1); `eventBadge` (Task 4); `useContextStore`.
- Produces: `HomeView` (default landing); `SuggestionsPanel`; `TodoList`.

> Verified manually. The current dashboard view (class overview) moves from `/` to `/overview`.

- [ ] **Step 1: Create `src/modules/home/components/SuggestionsPanel.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Box, Typography, Paper, Button, Stack, Alert } from '@mui/material'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { computeSuggestions, type SuggestionCard } from '../../schedule/signals/suggestionRules'
import { weekToDate } from '../../../shared/scheduleAnchors'

export function SuggestionsPanel({ onTaskCreated }: { onTaskCreated: () => void }) {
  const { selectedModule, selectedPresentation, currentWeek } = useContextStore()
  const [cards, setCards] = useState<SuggestionCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!selectedModule || !selectedPresentation) { setCards([]); return }
    container.dataService.getCourse(selectedModule, selectedPresentation)
      .then((course) => { if (active) setCards(computeSuggestions(course, currentWeek)) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Failed to compute suggestions') })
    return () => { active = false }
  }, [selectedModule, selectedPresentation, currentWeek])

  async function accept(card: SuggestionCard) {
    setBusyId(card.id); setError(null)
    try {
      await container.scheduleService.create({
        module: selectedModule, presentation: selectedPresentation,
        kind: 'task', title: card.defaultTask.title,
        date: weekToDate(selectedPresentation, currentWeek),
        week: currentWeek, source: 'suggestion', status: 'open',
        student_id: card.defaultTask.student_id,
      })
      setCards((cs) => cs.filter((c) => c.id !== card.id))
      onTaskCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Suggested actions</Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {cards.length === 0 && <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Nothing needs attention this week.</Typography>}
      <Stack spacing={1}>
        {cards.map((card) => (
          <Paper key={card.id} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ mr: 'auto' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>💡 {card.title}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{card.detail}</Typography>
            </Box>
            <Button variant="contained" size="small" disabled={busyId === card.id} onClick={() => accept(card)}>
              {busyId === card.id ? 'Adding…' : 'Add to schedule'}
            </Button>
          </Paper>
        ))}
      </Stack>
    </Box>
  )
}
```

- [ ] **Step 2: Create `src/modules/home/components/TodoList.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Box, Typography, Paper, Stack, Chip, Button, Alert } from '@mui/material'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { eventBadge } from '../../schedule/eventDisplay'
import type { ScheduleEvent } from '../../../types/domain'

export function TodoList({ reloadKey }: { reloadKey: number }) {
  const { selectedModule, selectedPresentation } = useContextStore()
  const [items, setItems] = useState<ScheduleEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!selectedModule || !selectedPresentation) return
    setError(null)
    try {
      const all = await container.scheduleService.list(selectedModule, selectedPresentation)
      const now = Date.now()
      const visible = all.filter((e) =>
        (e.kind === 'task' && e.status === 'open') ||
        ((e.kind === 'class' || e.kind === 'lecture') && new Date(e.date).getTime() >= now))
      visible.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      setItems(visible)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load to-do list')
    }
  }, [selectedModule, selectedPresentation])

  useEffect(() => { load() }, [load, reloadKey])

  async function markDone(e: ScheduleEvent) {
    if (!e._id) return
    await container.scheduleService.update(e._id, { status: 'done' })
    await load()
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>To-do</Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {items.length === 0 && <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Nothing upcoming.</Typography>}
      <Stack spacing={1}>
        {items.map((e) => {
          const badge = eventBadge(e)
          return (
            <Paper key={e._id} variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center' }}>
              <Box sx={{ mr: 'auto' }}>
                <Typography sx={{ fontSize: 13 }}>{badge.emoji} {e.title}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {new Date(e.date).toLocaleDateString()} · <Chip component="span" label={badge.label} size="small" sx={{ height: 16, fontSize: 9 }} />
                </Typography>
              </Box>
              {e.kind === 'task' && e.status === 'open' &&
                <Button size="small" onClick={() => markDone(e)}>Done</Button>}
            </Paper>
          )
        })}
      </Stack>
    </Box>
  )
}
```

- [ ] **Step 3: Create `src/modules/home/views/HomeView.tsx`**

```tsx
import { useState } from 'react'
import { Box, Grid } from '@mui/material'
import { SuggestionsPanel } from '../components/SuggestionsPanel'
import { TodoList } from '../components/TodoList'

export function HomeView() {
  const [reloadKey, setReloadKey] = useState(0)
  return (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <SuggestionsPanel onTaskCreated={() => setReloadKey((k) => k + 1)} />
        </Grid>
        <Grid item xs={12} md={6}>
          <TodoList reloadKey={reloadKey} />
        </Grid>
      </Grid>
    </Box>
  )
}
```

- [ ] **Step 4: Re-route in `src/App.tsx`**

Add the import:
```tsx
import { HomeView } from './modules/home/views/HomeView'
```
Change the existing `<Route path="/" element={<DashboardView />} />` to two routes:
```tsx
<Route path="/" element={<HomeView />} />
<Route path="/overview" element={<DashboardView />} />
```

- [ ] **Step 5: Update `src/modules/registry.tsx`**

Add a Home import and entry, and relabel the existing dashboard entry to `/overview`:
```tsx
import HomeIcon from '@mui/icons-material/HomeRounded'
```
Make the **first** registry entry Home:
```tsx
  { id: 'home', label: 'Home', path: '/', icon: <HomeIcon fontSize="small" /> },
```
And change the existing dashboard entry's `path` from `'/'` to `'/overview'` and its `label` to `'Class overview'`.

- [ ] **Step 6: Manual verification**

With `npm run server` + `npm run dev`:
1. App opens on **Home** (`/`); the sidebar shows Home first, "Class overview" points to `/overview`.
2. Suggested-action cards render for a course/week where signals fire (e.g. set `currentWeek` to a week with escalations).
3. Click **Add to schedule** on a card → it disappears from suggestions, a task appears in the To-do list, and the same task shows on the Weekly Schedule for that week.
4. Click **Done** on a to-do task → it leaves the list.
Type-check: `npx tsc --noEmit` → no errors.

- [ ] **Step 7: Commit**

```bash
git add src/modules/home/ src/App.tsx src/modules/registry.tsx
git commit -m "feat: add home page with rule-based suggestions and to-do list"
```

---

## Task 7: Migration + lecture seeding script, remove dead components

**Files:**
- Create: `scripts/migrate-schedule-events.ts`
- Delete: `src/modules/class/components/ScheduleCrud.tsx`
- Delete: `src/modules/dashboard/components/CourseSchedule.tsx`
- Grep-check: no remaining imports of either deleted file.

**Interfaces:**
- Consumes: `PRESENTATION_ANCHORS`, `weekToDate` (Task 1); Mongo `schedules` (legacy) + `schedule_events` (new).
- Produces: populated `schedule_events` collection (classes migrated, lectures seeded).

- [ ] **Step 1: Create `scripts/migrate-schedule-events.ts`**

```ts
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
```

- [ ] **Step 2: Run the migration**

Run: `npx tsx scripts/migrate-schedule-events.ts`
Expected: prints `Migrated N class events; seeded up to M lecture events.` and exits 0.

- [ ] **Step 3: Verify seeded data via the API**

Run `npm run server`, then:
```bash
curl -s "http://localhost:8000/api/schedule-events?module=AAA&presentation=2013J&kind=lecture" | head -c 300
```
Expected: a JSON array of lecture events with `date` values starting at `2013-10-07`. Stop the server.

- [ ] **Step 4: Delete the dead components and confirm no references**

Run:
```bash
rm src/modules/class/components/ScheduleCrud.tsx src/modules/dashboard/components/CourseSchedule.tsx
grep -rn "ScheduleCrud\|CourseSchedule" src || echo "no references"
```
Expected: `no references`. If any remain, remove those imports/usages.

- [ ] **Step 5: Full type-check and test run**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate-schedule-events.ts
git add -u
git commit -m "feat: migrate legacy schedules, seed lectures, remove dead schedule components"
```

---

## Self-Review notes (for the implementer)

- **Spec §5–§8 (model, anchors, routes, port):** Tasks 1–3. **§10 rules:** Task 4. **§9.1 calendar:** Task 5. **§9.2 home:** Task 6. **§11 migration/seeding:** Task 7. **§12 testing:** unit tests in Tasks 1–4, manual acceptance in Tasks 5–7.
- The `create_task` seam the spec promises Spec 2 is `container.scheduleService.create({ kind: 'task', ... })`, exercised by `SuggestionsPanel.accept` in Task 6 — no further change needed for Spec 2.
- `student_id` is a number in the OULAD domain; `ScheduleEvent.student_id` is `number | null` accordingly (consistent across Tasks 1, 4, 6).
- Engagement-drop ratio (0.5) and max-cards (3) are tunable constants in Task 4, not magic numbers buried in logic.
