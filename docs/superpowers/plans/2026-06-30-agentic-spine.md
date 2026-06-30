# Agentic Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the chat agent from a one-shot text streamer into a tool-using agentic loop (read tools auto-run; write tools require approval) so the teacher can triage at-risk students and have the agent propose and execute interventions.

**Architecture:** A client-side, non-streaming manual tool loop inside `ClaudeAgentAdapter`, calling Anthropic through the existing `/api/claude` Vite proxy. The loop's control flow is extracted into an injectable pure function (`runAgentLoop`) so it is unit-testable with scripted Anthropic responses. Four tools — two read (over local JSON via `dataService`), two write (`create_task` via Spec 1's `scheduleService`, `send_notification` via a new notification endpoint) — with each write gated by an approval callback the UI resolves.

**Tech Stack:** TypeScript (strict), React 18, MUI v5, Zustand, Express 5 + MongoDB (via `tsx`), Vite 5, Vitest. Model `claude-sonnet-4-6`.

## Global Constraints

- TypeScript strict; no `any` in new client code except the established `catch (error: any)` server pattern and `as` casts on scripted test fixtures.
- Client API base URL: `import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api'` (exact fallback).
- All client API calls MUST throw on non-2xx — no silent failures.
- Agent model id is exactly `claude-sonnet-4-6`. The request sends `tools` and is **non-streaming** (no `stream: true`); it sends no `temperature`/`top_p`/`top_k`/`budget_tokens` (those 400 on this model).
- The agent calls Anthropic at `/api/claude/v1/messages` (the Vite dev proxy injects the key).
- Domain time-series arrays are indexed `0 = week 1`; course week `W` is array index `W - 1`.
- Every write tool requires approval — `send_notification` and `create_task` never execute without an `{ action: 'approve' }` decision.
- New Mongo collection is exactly `student_notifications`; do not touch other collections.
- Commit after every task with the message in its final step.

---

## File Structure

**Create:**
- `src/shared/studentNotificationValidation.ts` — `validateStudentNotification` (shared server + tests).
- `src/shared/studentNotificationValidation.test.ts`
- `src/ports/NotificationService.ts` — port.
- `src/adapters/ApiNotificationAdapter.ts` — REST adapter.
- `src/adapters/ApiNotificationAdapter.test.ts`
- `src/modules/chat/agent/readTools.ts` — `listAtRiskStudents`, `getStudentDetail` (pure).
- `src/modules/chat/agent/readTools.test.ts`
- `src/modules/chat/agent/tools.ts` — tool schemas + `WRITE_TOOLS`.
- `src/modules/chat/agent/executeTool.ts` — `executeTool`, `AgentDeps`.
- `src/modules/chat/agent/runAgentLoop.ts` — injectable loop control flow.
- `src/modules/chat/agent/runAgentLoop.test.ts`
- `src/modules/chat/components/ProposedActionCard.tsx` — approval card.

**Modify:**
- `src/types/domain.ts` — append agent + notification types.
- `server/index.ts` — add `/api/student-notifications` routes.
- `src/di/container.ts` — register `notificationService`.
- `src/ports/AgentService.ts` — replace `stream()` with `run()`.
- `src/adapters/ClaudeAgentAdapter.ts` — implement `run()` via `runAgentLoop`; model bump.
- `src/shared/stores/chatStore.ts` — add `pendingPrompt`.
- `src/modules/chat/components/ChatPanel.tsx` — drive `run()`, approval cards, seeded prompt.
- `src/modules/home/components/SuggestionsPanel.tsx` — add "Ask agent" action.

---

## Task 1: Domain types (agent loop + student notification)

**Files:**
- Modify: `src/types/domain.ts` (append at end)

**Interfaces:**
- Produces: `ProposedActionTool`, `ProposedAction`, `ApprovalDecision`, `AgentEvent`, `AgentRunCallbacks`, `StudentNotificationType`, `StudentNotification`.

- [ ] **Step 1: Append the types to `src/types/domain.ts`**

```ts
// ─── Agentic loop ────────────────────────────────────────────────────────────

export type ProposedActionTool = 'send_notification' | 'create_task'

export interface ProposedAction {
  tool: ProposedActionTool
  input: Record<string, unknown>   // tool_use input, editable before approval
  preview: string                  // human-readable summary for the card
}

export type ApprovalDecision =
  | { action: 'approve'; input?: Record<string, unknown> }
  | { action: 'reject'; reason?: string }

export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_start'; tool: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool: string; ok: boolean; summary: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

export interface AgentRunCallbacks {
  onEvent(e: AgentEvent): void
  requestApproval(action: ProposedAction): Promise<ApprovalDecision>
}

// ─── Student notifications ───────────────────────────────────────────────────

export type StudentNotificationType = 'intervention' | 'encouragement' | 'reminder' | 'general'

export interface StudentNotification {
  _id?: string
  student_id: number
  module: string
  presentation: string
  title: string
  body: string
  type: StudentNotificationType
  created_at: string
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/types/domain.ts
git commit -m "feat: add agent loop and student notification domain types"
```

---

## Task 2: Student-notification server endpoint + validator

**Files:**
- Create: `src/shared/studentNotificationValidation.ts`
- Test: `src/shared/studentNotificationValidation.test.ts`
- Modify: `server/index.ts`

**Interfaces:**
- Consumes: `StudentNotification` (Task 1).
- Produces: `validateStudentNotification(n: Partial<StudentNotification>): string[]`; routes `POST /api/student-notifications`, `GET /api/student-notifications`.

- [ ] **Step 1: Write the failing test `src/shared/studentNotificationValidation.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { validateStudentNotification } from './studentNotificationValidation'

describe('validateStudentNotification', () => {
  const base = { student_id: 12, module: 'AAA', presentation: '2013J', title: 't', body: 'b', type: 'intervention' as const }

  it('passes a valid notification', () => {
    expect(validateStudentNotification(base)).toEqual([])
  })
  it('flags missing string fields', () => {
    expect(validateStudentNotification({ student_id: 12 })).toEqual(
      expect.arrayContaining(['Missing required field: module', 'Missing required field: title']),
    )
  })
  it('requires a numeric student_id', () => {
    expect(validateStudentNotification({ ...base, student_id: undefined })).toContain('Missing required field: student_id')
  })
  it('rejects an unknown type', () => {
    expect(validateStudentNotification({ ...base, type: 'spam' as never })).toContain('Invalid type: spam')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/studentNotificationValidation.test.ts`
Expected: FAIL — cannot resolve `./studentNotificationValidation`.

- [ ] **Step 3: Implement `src/shared/studentNotificationValidation.ts`**

```ts
import type { StudentNotification } from '../types/domain'

const TYPES = ['intervention', 'encouragement', 'reminder', 'general']

export function validateStudentNotification(n: Partial<StudentNotification>): string[] {
  const errors: string[] = []
  if (typeof n.student_id !== 'number') errors.push('Missing required field: student_id')
  for (const field of ['module', 'presentation', 'title', 'body', 'type'] as const) {
    if (!n[field]) errors.push(`Missing required field: ${field}`)
  }
  if (n.type && !TYPES.includes(n.type)) errors.push(`Invalid type: ${n.type}`)
  return errors
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/shared/studentNotificationValidation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Add the routes to `server/index.ts`**

Add the import after the existing `validateScheduleEvent` import:
```ts
import { validateStudentNotification } from '../src/shared/studentNotificationValidation'
```

Add these handlers next to the `schedule-events` handlers:
```ts
app.get('/api/student-notifications', async (req, res) => {
  try {
    const { module, presentation, student_id } = req.query
    const filter: Record<string, unknown> = {}
    if (module) filter.module = module
    if (presentation) filter.presentation = presentation
    if (student_id) filter.student_id = Number(student_id)
    const notes = await db.collection('student_notifications').find(filter).sort({ created_at: -1 }).toArray()
    res.status(200).json(notes)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/student-notifications', async (req, res) => {
  try {
    const errors = validateStudentNotification(req.body)
    if (errors.length) return res.status(400).json({ error: errors.join('; ') })
    const note = { ...req.body, created_at: new Date().toISOString() }
    delete note._id
    const result = await db.collection('student_notifications').insertOne(note)
    res.status(201).json({ _id: result.insertedId, ...note })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})
```

- [ ] **Step 6: Verify the server boots and the route responds**

Run (one shell): `npm run server`
Then: `curl -s "http://localhost:8000/api/student-notifications?module=AAA&presentation=2013J"`
Expected: `[]` HTTP 200; server logs `Connected to MongoDB Atlas!`. Stop the server.
(If the DB is unreachable from this environment, note it and rely on the validator unit tests + `npx tsc --noEmit`.)

- [ ] **Step 7: Commit**

```bash
git add src/shared/studentNotificationValidation.ts src/shared/studentNotificationValidation.test.ts server/index.ts
git commit -m "feat: add student-notifications endpoint and validator"
```

---

## Task 3: NotificationService port + adapter + DI

**Files:**
- Create: `src/ports/NotificationService.ts`
- Create: `src/adapters/ApiNotificationAdapter.ts`
- Test: `src/adapters/ApiNotificationAdapter.test.ts`
- Modify: `src/di/container.ts`

**Interfaces:**
- Consumes: `StudentNotification` (Task 1).
- Produces: `NotificationService` interface; `ApiNotificationAdapter`; `container.notificationService`.

- [ ] **Step 1: Create the port `src/ports/NotificationService.ts`**

```ts
import type { StudentNotification } from '../types/domain'

export interface NotificationService {
  send(n: Omit<StudentNotification, '_id' | 'created_at'>): Promise<StudentNotification>
  list(module: string, presentation: string, studentId?: number): Promise<StudentNotification[]>
}
```

- [ ] **Step 2: Write the failing test `src/adapters/ApiNotificationAdapter.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiNotificationAdapter } from './ApiNotificationAdapter'

const adapter = new ApiNotificationAdapter()

beforeEach(() => { vi.restoreAllMocks() })

describe('ApiNotificationAdapter', () => {
  it('posts a notification', async () => {
    const saved = { _id: '1', student_id: 12, module: 'AAA', presentation: '2013J', title: 't', body: 'b', type: 'intervention', created_at: 'now' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => saved }))
    const result = await adapter.send({ student_id: 12, module: 'AAA', presentation: '2013J', title: 't', body: 'b', type: 'intervention' })
    expect(result).toEqual(saved)
    expect((fetch as any).mock.calls[0][0]).toContain('/student-notifications')
  })

  it('throws with server detail on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Missing required field: title' }) }))
    await expect(adapter.send({ student_id: 12, module: 'AAA', presentation: '2013J', title: '', body: 'b', type: 'intervention' }))
      .rejects.toThrow(/400: Missing required field: title/)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/adapters/ApiNotificationAdapter.test.ts`
Expected: FAIL — cannot resolve `./ApiNotificationAdapter`.

- [ ] **Step 4: Implement `src/adapters/ApiNotificationAdapter.ts`**

```ts
import type { StudentNotification } from '../types/domain'
import type { NotificationService } from '../ports/NotificationService'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.error ?? '' } catch { /* non-JSON body */ }
    throw new Error(`Notification API ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  return res.json() as Promise<T>
}

export class ApiNotificationAdapter implements NotificationService {
  async send(n: Omit<StudentNotification, '_id' | 'created_at'>): Promise<StudentNotification> {
    return handle<StudentNotification>(await fetch(`${API_BASE}/student-notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n),
    }))
  }

  async list(module: string, presentation: string, studentId?: number): Promise<StudentNotification[]> {
    const params = new URLSearchParams({ module, presentation })
    if (studentId != null) params.set('student_id', String(studentId))
    return handle<StudentNotification[]>(await fetch(`${API_BASE}/student-notifications?${params.toString()}`))
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/adapters/ApiNotificationAdapter.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Register in `src/di/container.ts`**

Add imports:
```ts
import { ApiNotificationAdapter } from '../adapters/ApiNotificationAdapter'
import type { NotificationService } from '../ports/NotificationService'
```
Add `notificationService` to the container type and value (keep all existing entries):
```ts
  scheduleService: ScheduleService
  notificationService: NotificationService
} = {
  dataService: new ProcessedDataAdapter(),
  agentService: new ClaudeAgentAdapter(),
  masteryService: new MockMasteryAdapter(),
  scheduleService: new ApiScheduleAdapter(),
  notificationService: new ApiNotificationAdapter(),
}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/ports/NotificationService.ts src/adapters/ApiNotificationAdapter.ts src/adapters/ApiNotificationAdapter.test.ts src/di/container.ts
git commit -m "feat: add NotificationService port, adapter, and DI registration"
```

---

## Task 4: Read-tool data functions

**Files:**
- Create: `src/modules/chat/agent/readTools.ts`
- Test: `src/modules/chat/agent/readTools.test.ts`

**Interfaces:**
- Consumes: `ProcessedCourse`, `StudentProfile` (domain).
- Produces:
  - `interface AtRiskStudent { id_student: number; tier: number; risk: number; decayed_engagement: number }`
  - `listAtRiskStudents(course: ProcessedCourse, week: number, limit?: number): AtRiskStudent[]`
  - `interface StudentDetail { id_student: number; tier_now: number | null; tier_prev: number | null; risk_now: number | null; engagement_now: number | null; cohort_p75: number | null; missing_assessments: number[]; lstm_forecast: number | null }`
  - `getStudentDetail(course: ProcessedCourse, studentId: number, week: number): StudentDetail | null`

- [ ] **Step 1: Write the failing test `src/modules/chat/agent/readTools.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { listAtRiskStudents, getStudentDetail } from './readTools'
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

// week 3 -> index 2
const course: ProcessedCourse = {
  module: 'AAA', presentation: '2013J', num_weeks: 39,
  cohort_p75_decayed: [0, 0, 50],
  students: [
    student(11, { tier_by_week: [1, 2, 3], risk_by_week: [0.2, 0.5, 0.8], decayed_engagement: [80, 40, 10],
      assessments: [{ id_assessment: 101, assessment_type: 'TMA', date_due: 10, weight: 10, score: null, date_submitted: null }] }),
    student(12, { tier_by_week: [1, 1, 1], risk_by_week: [0.1, 0.1, 0.1], decayed_engagement: [80, 80, 90] }),
  ],
}

describe('listAtRiskStudents', () => {
  it('ranks tier-3/2 students above tier-1 and caps the list', () => {
    const result = listAtRiskStudents(course, 3, 1)
    expect(result).toHaveLength(1)
    expect(result[0].id_student).toBe(11)
    expect(result[0].tier).toBe(3)
  })
})

describe('getStudentDetail', () => {
  it('returns current/previous tier and past-due unsubmitted assessments', () => {
    const d = getStudentDetail(course, 11, 3)!
    expect(d.tier_now).toBe(3)
    expect(d.tier_prev).toBe(2)
    expect(d.missing_assessments).toEqual([101])  // due day 10 <= week-3 day 14, not submitted
    expect(d.cohort_p75).toBe(50)
  })
  it('returns null for an unknown student', () => {
    expect(getStudentDetail(course, 999, 3)).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/chat/agent/readTools.test.ts`
Expected: FAIL — cannot resolve `./readTools`.

- [ ] **Step 3: Implement `src/modules/chat/agent/readTools.ts`**

```ts
import type { ProcessedCourse, StudentProfile } from '../../../types/domain'

// Domain arrays are 0-indexed at week 1, so week W is index W - 1.
const at = <T>(arr: T[], week: number): T | undefined => arr[week - 1]

export interface AtRiskStudent {
  id_student: number
  tier: number
  risk: number
  decayed_engagement: number
}

export function listAtRiskStudents(course: ProcessedCourse, week: number, limit = 10): AtRiskStudent[] {
  const rows: AtRiskStudent[] = course.students.map((s) => ({
    id_student: s.id_student,
    tier: at(s.tier_by_week, week) ?? 1,
    risk: at(s.risk_by_week, week) ?? 0,
    decayed_engagement: at(s.decayed_engagement, week) ?? 0,
  }))
  return rows
    .filter((r) => r.tier >= 2)
    .sort((a, b) => b.tier - a.tier || b.risk - a.risk)
    .slice(0, limit)
}

const LSTM_WINDOWS = ['w25', 'w20', 'w15', 'w10', 'w05'] as const

function lstmForecast(s: StudentProfile): number | null {
  if (!s.lstm_trajectories) return null
  for (const key of LSTM_WINDOWS) {
    const arr = s.lstm_trajectories[key]
    if (!arr) continue
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] != null) return arr[i] as number
    }
  }
  return null
}

export interface StudentDetail {
  id_student: number
  tier_now: number | null
  tier_prev: number | null
  risk_now: number | null
  engagement_now: number | null
  cohort_p75: number | null
  missing_assessments: number[]
  lstm_forecast: number | null
}

export function getStudentDetail(course: ProcessedCourse, studentId: number, week: number): StudentDetail | null {
  const s = course.students.find((st) => st.id_student === studentId)
  if (!s) return null
  const weekDay = (week - 1) * 7
  const missing = s.assessments
    .filter((a) => a.date_due != null && a.date_due <= weekDay && a.date_submitted == null)
    .map((a) => a.id_assessment)
  return {
    id_student: s.id_student,
    tier_now: at(s.tier_by_week, week) ?? null,
    tier_prev: week >= 2 ? at(s.tier_by_week, week - 1) ?? null : null,
    risk_now: at(s.risk_by_week, week) ?? null,
    engagement_now: at(s.decayed_engagement, week) ?? null,
    cohort_p75: at(course.cohort_p75_decayed, week) ?? null,
    missing_assessments: missing,
    lstm_forecast: lstmForecast(s),
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/chat/agent/readTools.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/chat/agent/readTools.ts src/modules/chat/agent/readTools.test.ts
git commit -m "feat: add read-tool data functions for the agent"
```

---

## Task 5: Tool schemas + executeTool dispatcher

**Files:**
- Create: `src/modules/chat/agent/tools.ts`
- Create: `src/modules/chat/agent/executeTool.ts`

**Interfaces:**
- Consumes: `listAtRiskStudents`, `getStudentDetail` (Task 4); `DataService`, `ScheduleService`, `NotificationService` ports; `AgentContext`; `weekToDate` (Spec 1, `src/shared/scheduleAnchors`).
- Produces:
  - `interface ToolDefinition { name: string; description: string; input_schema: object }`
  - `TOOL_DEFINITIONS: ToolDefinition[]`; `WRITE_TOOLS: Set<string>`
  - `interface AgentDeps { dataService: DataService; scheduleService: ScheduleService; notificationService: NotificationService }`
  - `interface ToolExecResult { ok: boolean; content: string }`
  - `executeTool(name: string, input: Record<string, unknown>, ctx: AgentContext, deps: AgentDeps): Promise<ToolExecResult>`

> No standalone test — `executeTool` is exercised through `runAgentLoop` (Task 6) with stubbed deps.

- [ ] **Step 1: Create `src/modules/chat/agent/tools.ts`**

```ts
export interface ToolDefinition {
  name: string
  description: string
  input_schema: object
}

export const WRITE_TOOLS = new Set<string>(['send_notification', 'create_task'])

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'list_at_risk_students',
    description: 'List the most at-risk students (tier 2 or 3) for the current course and week, ranked by risk tier then risk score. Use this first when asked who needs attention.',
    input_schema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max students to return (default 10).' } },
    },
  },
  {
    name: 'get_student_detail',
    description: "Get one student's current risk tier, previous-week tier, engagement, cohort baseline, past-due unsubmitted assessments, and LSTM risk forecast. Use this to diagnose before proposing an intervention.",
    input_schema: {
      type: 'object',
      properties: { student_id: { type: 'number', description: 'The id_student to inspect.' } },
      required: ['student_id'],
    },
  },
  {
    name: 'send_notification',
    description: 'Send a notification to a student. Requires teacher approval before it is sent.',
    input_schema: {
      type: 'object',
      properties: {
        student_id: { type: 'number' },
        title: { type: 'string' },
        body: { type: 'string' },
        type: { type: 'string', enum: ['intervention', 'encouragement', 'reminder', 'general'] },
      },
      required: ['student_id', 'title', 'body', 'type'],
    },
  },
  {
    name: 'create_task',
    description: "Create a follow-up intervention task on the teacher's schedule for a student. Requires teacher approval before it is created.",
    input_schema: {
      type: 'object',
      properties: {
        student_id: { type: 'number' },
        title: { type: 'string' },
        due_week: { type: 'number', description: 'Course week the task is due (defaults to the current week).' },
        note: { type: 'string' },
      },
      required: ['student_id', 'title'],
    },
  },
]
```

- [ ] **Step 2: Create `src/modules/chat/agent/executeTool.ts`**

```ts
import type { AgentContext, StudentNotificationType, TaskSource } from '../../../types/domain'
import type { DataService } from '../../../ports/DataService'
import type { ScheduleService } from '../../../ports/ScheduleService'
import type { NotificationService } from '../../../ports/NotificationService'
import { weekToDate } from '../../../shared/scheduleAnchors'
import { listAtRiskStudents, getStudentDetail } from './readTools'

export interface AgentDeps {
  dataService: DataService
  scheduleService: ScheduleService
  notificationService: NotificationService
}

export interface ToolExecResult {
  ok: boolean
  content: string   // JSON string returned to the model as the tool_result
}

export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  ctx: AgentContext,
  deps: AgentDeps,
): Promise<ToolExecResult> {
  try {
    if (name === 'list_at_risk_students') {
      const course = await deps.dataService.getCourse(ctx.module, ctx.presentation)
      const limit = typeof input.limit === 'number' ? input.limit : 10
      return { ok: true, content: JSON.stringify(listAtRiskStudents(course, ctx.currentWeek, limit)) }
    }

    if (name === 'get_student_detail') {
      const course = await deps.dataService.getCourse(ctx.module, ctx.presentation)
      const detail = getStudentDetail(course, Number(input.student_id), ctx.currentWeek)
      return detail
        ? { ok: true, content: JSON.stringify(detail) }
        : { ok: false, content: `No student #${input.student_id} in ${ctx.module} ${ctx.presentation}.` }
    }

    if (name === 'send_notification') {
      const saved = await deps.notificationService.send({
        student_id: Number(input.student_id),
        module: ctx.module,
        presentation: ctx.presentation,
        title: String(input.title),
        body: String(input.body),
        type: (input.type as StudentNotificationType) ?? 'general',
      })
      return { ok: true, content: `Notification sent (id ${saved._id ?? 'unknown'}).` }
    }

    if (name === 'create_task') {
      const dueWeek = typeof input.due_week === 'number' ? input.due_week : ctx.currentWeek
      const created = await deps.scheduleService.create({
        module: ctx.module,
        presentation: ctx.presentation,
        kind: 'task',
        title: String(input.title),
        date: weekToDate(ctx.presentation, dueWeek),
        week: dueWeek,
        source: 'intervention' as TaskSource,
        status: 'open',
        student_id: Number(input.student_id),
      })
      return { ok: true, content: `Task created (id ${created._id ?? 'unknown'}) for week ${dueWeek}.` }
    }

    return { ok: false, content: `Unknown tool: ${name}` }
  } catch (e) {
    return { ok: false, content: e instanceof Error ? e.message : 'Tool execution failed' }
  }
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/modules/chat/agent/tools.ts src/modules/chat/agent/executeTool.ts
git commit -m "feat: add agent tool schemas and executeTool dispatcher"
```

---

## Task 6: runAgentLoop control flow

**Files:**
- Create: `src/modules/chat/agent/runAgentLoop.ts`
- Test: `src/modules/chat/agent/runAgentLoop.test.ts`

**Interfaces:**
- Consumes: `executeTool`, `AgentDeps` (Task 5); `WRITE_TOOLS`, `ToolDefinition` (Task 5); `AgentContext`, `AgentRunCallbacks` (Task 1).
- Produces:
  - `interface AnthropicResponse { stop_reason: string; content: AnthropicBlock[] }`
  - `interface RunAgentLoopParams { system: string; messages: AnthropicMessage[]; tools: ToolDefinition[]; context: AgentContext; deps: AgentDeps; callbacks: AgentRunCallbacks; postToAnthropic: (body: object) => Promise<AnthropicResponse> }`
  - `runAgentLoop(p: RunAgentLoopParams): Promise<void>`

- [ ] **Step 1: Write the failing test `src/modules/chat/agent/runAgentLoop.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest'
import { runAgentLoop } from './runAgentLoop'
import { TOOL_DEFINITIONS } from './tools'
import type { AgentContext, AgentEvent, ProcessedCourse } from '../../../types/domain'
import type { AgentDeps } from './executeTool'

const ctx: AgentContext = {
  module: 'AAA', presentation: '2013J', currentWeek: 3, numWeeks: 39,
  activeStudent: null, tierCounts: { tier1: 0, tier2: 0, tier3: 1 },
}

const course = { module: 'AAA', presentation: '2013J', num_weeks: 39, cohort_p75_decayed: [0,0,50], students: [] } as unknown as ProcessedCourse

function deps(createSpy = vi.fn().mockResolvedValue({ _id: 'task1' })): AgentDeps {
  return {
    dataService: { getCourse: vi.fn().mockResolvedValue(course), getIndex: vi.fn(), getStudent: vi.fn() } as any,
    scheduleService: { create: createSpy, list: vi.fn(), update: vi.fn(), remove: vi.fn() } as any,
    notificationService: { send: vi.fn(), list: vi.fn() } as any,
  }
}

// Scripted Anthropic responses: read tool, then write tool, then end_turn.
function scriptedPost() {
  const responses = [
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'list_at_risk_students', input: {} }] },
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't2', name: 'create_task', input: { student_id: 11, title: 'Check in' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done.' }] },
  ]
  let i = 0
  return vi.fn(async () => responses[i++])
}

describe('runAgentLoop', () => {
  it('auto-runs read tools, requires approval for writes, and ends on end_turn', async () => {
    const events: AgentEvent[] = []
    const createSpy = vi.fn().mockResolvedValue({ _id: 'task1' })
    const requestApproval = vi.fn().mockResolvedValue({ action: 'approve' })

    await runAgentLoop({
      system: 'sys', messages: [{ role: 'user', content: 'who is at risk?' }],
      tools: TOOL_DEFINITIONS, context: ctx, deps: deps(createSpy),
      callbacks: { onEvent: (e) => events.push(e), requestApproval },
      postToAnthropic: scriptedPost(),
    })

    expect(requestApproval).toHaveBeenCalledTimes(1)         // only the write tool
    expect(createSpy).toHaveBeenCalledTimes(1)               // approved write executed
    expect(events.at(-1)).toEqual({ type: 'done' })
    expect(events.some((e) => e.type === 'text' && e.text === 'Done.')).toBe(true)
  })

  it('does not execute a rejected write and returns an error tool_result', async () => {
    const createSpy = vi.fn()
    const requestApproval = vi.fn().mockResolvedValue({ action: 'reject' })

    await runAgentLoop({
      system: 'sys', messages: [{ role: 'user', content: 'x' }],
      tools: TOOL_DEFINITIONS, context: ctx, deps: deps(createSpy),
      callbacks: { onEvent: () => {}, requestApproval },
      postToAnthropic: scriptedPost(),
    })

    expect(createSpy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/chat/agent/runAgentLoop.test.ts`
Expected: FAIL — cannot resolve `./runAgentLoop`.

- [ ] **Step 3: Implement `src/modules/chat/agent/runAgentLoop.ts`**

```ts
import type { AgentContext, AgentRunCallbacks, ProposedActionTool } from '../../../types/domain'
import type { ToolDefinition } from './tools'
import { WRITE_TOOLS } from './tools'
import { executeTool, type AgentDeps } from './executeTool'

export interface AnthropicBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

export interface AnthropicResponse {
  stop_reason: string
  content: AnthropicBlock[]
}

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: unknown
}

export interface RunAgentLoopParams {
  system: string
  messages: AnthropicMessage[]
  tools: ToolDefinition[]
  context: AgentContext
  deps: AgentDeps
  callbacks: AgentRunCallbacks
  postToAnthropic: (body: object) => Promise<AnthropicResponse>
}

const MODEL = 'claude-sonnet-4-6'
const MAX_TURNS = 8

function previewFor(name: string, input: Record<string, unknown>): string {
  if (name === 'send_notification') return `Send "${input.title}" to student #${input.student_id}`
  if (name === 'create_task') return `Create task "${input.title}" for student #${input.student_id}`
  return `${name}`
}

export async function runAgentLoop(p: RunAgentLoopParams): Promise<void> {
  const messages: AnthropicMessage[] = [...p.messages]

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await p.postToAnthropic({
        model: MODEL,
        max_tokens: 1024,
        system: p.system,
        tools: p.tools,
        messages,
      })

      for (const block of res.content) {
        if (block.type === 'text' && block.text) p.callbacks.onEvent({ type: 'text', text: block.text })
      }

      if (res.stop_reason !== 'tool_use') {
        p.callbacks.onEvent({ type: 'done' })
        return
      }

      const toolUses = res.content.filter((b) => b.type === 'tool_use')
      messages.push({ role: 'assistant', content: res.content })

      const toolResults: object[] = []
      for (const tu of toolUses) {
        const name = tu.name ?? ''
        const input = tu.input ?? {}
        p.callbacks.onEvent({ type: 'tool_start', tool: name, input })

        if (WRITE_TOOLS.has(name)) {
          const decision = await p.callbacks.requestApproval({
            tool: name as ProposedActionTool,
            input,
            preview: previewFor(name, input),
          })
          if (decision.action === 'reject') {
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: 'User rejected this action.', is_error: true })
            p.callbacks.onEvent({ type: 'tool_result', tool: name, ok: false, summary: 'Rejected by teacher' })
            continue
          }
          const finalInput = decision.input ?? input
          const r = await executeTool(name, finalInput, p.context, p.deps)
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: r.content, is_error: !r.ok })
          p.callbacks.onEvent({ type: 'tool_result', tool: name, ok: r.ok, summary: r.content })
        } else {
          const r = await executeTool(name, input, p.context, p.deps)
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: r.content, is_error: !r.ok })
          p.callbacks.onEvent({ type: 'tool_result', tool: name, ok: r.ok, summary: r.content })
        }
      }

      messages.push({ role: 'user', content: toolResults })
    }
    p.callbacks.onEvent({ type: 'done' })
  } catch (e) {
    p.callbacks.onEvent({ type: 'error', message: e instanceof Error ? e.message : 'Agent run failed' })
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/chat/agent/runAgentLoop.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/chat/agent/runAgentLoop.ts src/modules/chat/agent/runAgentLoop.test.ts
git commit -m "feat: add runAgentLoop tool-loop control flow"
```

---

## Task 7: AgentService.run + ClaudeAgentAdapter rewrite

**Files:**
- Modify: `src/ports/AgentService.ts`
- Modify: `src/adapters/ClaudeAgentAdapter.ts`

**Interfaces:**
- Consumes: `runAgentLoop`, `AnthropicResponse` (Task 6); `TOOL_DEFINITIONS` (Task 5); `container` services; `AgentRunCallbacks`, `ChatMessage`, `AgentContext`.
- Produces: `AgentService.run(messages, context, cb): Promise<void>`.

> The adapter keeps its old `stream()` method temporarily so `ChatPanel` still compiles; Task 8 removes both `stream()` and its interface declaration.

- [ ] **Step 1: Replace the interface in `src/ports/AgentService.ts`**

```ts
import type { ChatMessage, AgentContext, AgentRunCallbacks } from '../types/domain'

export interface AgentService {
  /** Runs the agentic tool loop, emitting events and requesting approval for writes. */
  run(
    messages: ChatMessage[],
    context: AgentContext,
    cb: AgentRunCallbacks,
  ): Promise<void>

  /** @deprecated one-shot text stream; removed once ChatPanel migrates to run(). */
  stream(
    messages: ChatMessage[],
    context: AgentContext,
  ): AsyncIterable<string>
}
```

- [ ] **Step 2: Update `src/adapters/ClaudeAgentAdapter.ts`**

Change the model constant:
```ts
const MODEL = 'claude-sonnet-4-6'
```
Add imports at the top:
```ts
import type { AgentRunCallbacks } from '../types/domain'
import { container } from '../di/container'
import { TOOL_DEFINITIONS, WRITE_TOOLS } from '../modules/chat/agent/tools'
import { runAgentLoop, type AnthropicResponse } from '../modules/chat/agent/runAgentLoop'
```
Add a `run` method to the `ClaudeAgentAdapter` class (keep the existing `stream` method as-is):
```ts
  async run(messages: ChatMessage[], context: AgentContext, cb: AgentRunCallbacks): Promise<void> {
    const toolGuidance = '\n\nYou have tools to inspect at-risk students and to act. ' +
      'When asked who needs attention, call list_at_risk_students, then get_student_detail to diagnose. ' +
      'Propose interventions with send_notification and create_task — these require teacher approval. ' +
      'Be concise.'

    const postToAnthropic = async (body: object): Promise<AnthropicResponse> => {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(`Claude API error ${res.status}: ${await res.text()}`)
      return res.json() as Promise<AnthropicResponse>
    }

    await runAgentLoop({
      system: buildSystemPrompt(context) + toolGuidance,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: TOOL_DEFINITIONS,
      context,
      deps: {
        dataService: container.dataService,
        scheduleService: container.scheduleService,
        notificationService: container.notificationService,
      },
      callbacks: cb,
      postToAnthropic,
    })
  }
```
Note: `WRITE_TOOLS` is imported for clarity but the loop owns it internally — if your linter flags the unused import, drop `WRITE_TOOLS` from this import line (keep `TOOL_DEFINITIONS`).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0 (ChatPanel still uses `stream()`, which still exists).

- [ ] **Step 4: Build**

Run: `npx vite build`
Expected: success (chunk-size warning is fine).

- [ ] **Step 5: Commit**

```bash
git add src/ports/AgentService.ts src/adapters/ClaudeAgentAdapter.ts
git commit -m "feat: add AgentService.run tool loop in ClaudeAgentAdapter (model claude-sonnet-4-6)"
```

---

## Task 8: ChatPanel rework + ProposedActionCard

**Files:**
- Modify: `src/shared/stores/chatStore.ts`
- Create: `src/modules/chat/components/ProposedActionCard.tsx`
- Modify: `src/modules/chat/components/ChatPanel.tsx`
- Modify: `src/ports/AgentService.ts` (remove `stream()`)
- Modify: `src/adapters/ClaudeAgentAdapter.ts` (remove `stream()` + SSE code)

**Interfaces:**
- Consumes: `container.agentService.run`; `AgentEvent`, `ProposedAction`, `ApprovalDecision` (Task 1).
- Produces: `ProposedActionCard` component; `chatStore.pendingPrompt` + `setPendingPrompt`.

> UI task — verified by `tsc` + `vite build` + manual run (no component test harness in this codebase).

- [ ] **Step 1: Add `pendingPrompt` to `src/shared/stores/chatStore.ts`**

Add to the `ChatState` interface:
```ts
  pendingPrompt: string | null
  setPendingPrompt: (p: string | null) => void
```
Add to the store body (alongside the other fields/actions):
```ts
  pendingPrompt: null,
  setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
```

- [ ] **Step 2: Create `src/modules/chat/components/ProposedActionCard.tsx`**

```tsx
import { useState } from 'react'
import { Paper, Box, Typography, Button, TextField, Stack } from '@mui/material'
import type { ProposedAction, ApprovalDecision } from '../../../types/domain'

export function ProposedActionCard({ action, onDecision }: {
  action: ProposedAction
  onDecision: (d: ApprovalDecision) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(String(action.input.title ?? ''))
  const [body, setBody] = useState(String(action.input.body ?? action.input.note ?? ''))

  const bodyKey = action.tool === 'send_notification' ? 'body' : 'note'

  function approve() {
    onDecision({ action: 'approve', input: { ...action.input, title, [bodyKey]: body } })
  }

  return (
    <Paper variant="outlined" sx={{ p: 1.5, my: 1, borderColor: '#ef6c00', borderLeft: '3px solid #ef6c00' }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#ef6c00', textTransform: 'uppercase', mb: 0.5 }}>
        {action.tool === 'send_notification' ? 'Proposed notification' : 'Proposed task'}
      </Typography>
      <Typography sx={{ fontSize: 13, mb: 1 }}>{action.preview}</Typography>

      {editing && (
        <Stack spacing={1} sx={{ mb: 1 }}>
          <TextField size="small" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField size="small" label={bodyKey === 'body' ? 'Body' : 'Note'} value={body} multiline minRows={2}
            onChange={(e) => setBody(e.target.value)} />
        </Stack>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="contained" onClick={approve}>Approve</Button>
        <Button size="small" onClick={() => setEditing((v) => !v)}>{editing ? 'Done editing' : 'Edit'}</Button>
        <Button size="small" color="error" onClick={() => onDecision({ action: 'reject' })}>Reject</Button>
      </Box>
    </Paper>
  )
}
```

- [ ] **Step 3: Rework `src/modules/chat/components/ChatPanel.tsx`**

Replace the imports block's domain-type import and add the new ones:
```tsx
import { useRef, useEffect, useState } from 'react'
import type { AgentContext, ChatMessage, StudentProfile, AgentEvent, ProposedAction, ApprovalDecision } from '../../../types/domain'
import { ProposedActionCard } from './ProposedActionCard'
```
Keep `buildContext`, `SUGGESTED_PROMPTS`, the `useQuery` course load, and the JSX shell unchanged. Replace the component's state + `sendMessage` with:
```tsx
  const { selectedModule, selectedPresentation, currentWeek, numWeeks, activeStudent, setChatPanelOpen } = useContextStore()
  const { messages, isStreaming, addMessage, appendToLast, setStreaming, clearMessages, pendingPrompt, setPendingPrompt } = useChatStore()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [activity, setActivity] = useState<string[]>([])
  const [pendingApproval, setPendingApproval] = useState<ProposedAction | null>(null)
  const approvalResolver = useRef<((d: ApprovalDecision) => void) | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
```
```tsx
  function requestApproval(action: ProposedAction): Promise<ApprovalDecision> {
    return new Promise((resolve) => { approvalResolver.current = resolve; setPendingApproval(action) })
  }
  function resolveApproval(d: ApprovalDecision) {
    setPendingApproval(null)
    approvalResolver.current?.(d)
    approvalResolver.current = null
  }

  function handleEvent(e: AgentEvent) {
    if (e.type === 'text') appendToLast(e.text)
    else if (e.type === 'tool_start') setActivity((a) => [...a, `▸ ${e.tool}`])
    else if (e.type === 'tool_result') setActivity((a) => [...a, `${e.ok ? '✓' : '✕'} ${e.tool}`])
    else if (e.type === 'error') setError(e.message)
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return
    setError(null); setInput(''); setActivity([])

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text.trim(), timestamp: new Date() }
    addMessage(userMsg)
    addMessage({ id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: new Date() })
    setStreaming(true)
    try {
      const ctx = buildContext(selectedModule, selectedPresentation, currentWeek, numWeeks, activeStudent, students)
      await container.agentService.run([...messages, userMsg], ctx, { onEvent: handleEvent, requestApproval })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setStreaming(false)
    }
  }

  // Run a prompt seeded from the Home suggestion cards.
  useEffect(() => {
    if (pendingPrompt) { const p = pendingPrompt; setPendingPrompt(null); sendMessage(p) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPrompt])
```
In the messages JSX, after the `{messages.map(...)}` block and before `<div ref={bottomRef} />`, add the activity chips and approval card:
```tsx
        {activity.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
            {activity.map((a, i) => (
              <Chip key={i} label={a} size="small" sx={{ fontSize: 10, height: 18, fontFamily: tokens.font.mono }} />
            ))}
          </Box>
        )}
        {pendingApproval && <ProposedActionCard action={pendingApproval} onDecision={resolveApproval} />}
```

- [ ] **Step 4: Remove `stream()` from the interface and adapter**

In `src/ports/AgentService.ts`, delete the `stream(...)` method (and the now-unused `@deprecated` comment), leaving only `run(...)`.

In `src/adapters/ClaudeAgentAdapter.ts`, delete the entire `async *stream(...)` method and any imports it alone used (the SSE reader code). Keep `buildSystemPrompt`, `MODEL`, `API_URL`, and `run`.

- [ ] **Step 5: Type-check and build**

Run: `npx tsc --noEmit && npx vite build`
Expected: tsc exit 0; build succeeds.

- [ ] **Step 6: Manual verification**

Run `npm run server` + `npm run dev`. Open the AI Advisor panel with a course selected, ask *"Which students need intervention this week?"*:
1. Activity chips show `▸ list_at_risk_students` then `✓ list_at_risk_students`, and a `get_student_detail` pair.
2. When the agent proposes a notification or task, a ProposedActionCard appears with Approve / Edit / Reject.
3. Reject → the agent continues without acting. Approve → the action executes (notification visible via `GET /api/student-notifications`; task appears on the Weekly Schedule).
4. With the API server stopped, a write Approve surfaces a red error (no silent failure).

- [ ] **Step 7: Commit**

```bash
git add src/shared/stores/chatStore.ts src/modules/chat/components/ProposedActionCard.tsx src/modules/chat/components/ChatPanel.tsx src/ports/AgentService.ts src/adapters/ClaudeAgentAdapter.ts
git commit -m "feat: drive agent tool loop with approval cards in ChatPanel; remove stream()"
```

---

## Task 9: Home "Ask agent" wiring

**Files:**
- Modify: `src/modules/home/components/SuggestionsPanel.tsx`

**Interfaces:**
- Consumes: `chatStore.setPendingPrompt` (Task 8); `contextStore.setChatPanelOpen`; `SuggestionCard` (Spec 1).

> UI task — verified by `tsc` + `vite build` + manual run.

- [ ] **Step 1: Add the "Ask agent" action to `src/modules/home/components/SuggestionsPanel.tsx`**

Add imports:
```ts
import { useChatStore } from '../../../shared/stores/chatStore'
```
Inside the component, pull the store actions (extend the existing `useContextStore` destructure to include `setChatPanelOpen`):
```ts
  const { selectedModule, selectedPresentation, currentWeek, setChatPanelOpen } = useContextStore()
  const setPendingPrompt = useChatStore((s) => s.setPendingPrompt)
```
Add the handler:
```ts
  function askAgent(card: SuggestionCard) {
    setPendingPrompt(`${card.title}. ${card.detail} Review the affected student(s) and propose interventions.`)
    setChatPanelOpen(true)
  }
```
In the card JSX, add an "Ask agent" button before the existing "Add to schedule" button:
```tsx
            <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={() => askAgent(card)}>
              Ask agent
            </Button>
            <Button variant="contained" size="small" disabled={busyId === card.id} onClick={() => accept(card)}>
              {busyId === card.id ? 'Adding…' : 'Add to schedule'}
            </Button>
```

- [ ] **Step 2: Type-check and build**

Run: `npx tsc --noEmit && npx vite build`
Expected: tsc exit 0; build succeeds.

- [ ] **Step 3: Manual verification**

Run `npm run server` + `npm run dev`. On Home, a suggestion card now shows **Ask agent** and **Add to schedule**. Click **Ask agent** → the chat panel opens and the agent runs the loop on that situation (reads the watchlist, proposes interventions with approval cards). **Add to schedule** still creates the task directly as before.

- [ ] **Step 4: Final full check + commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: tsc exit 0; all tests pass.

```bash
git add src/modules/home/components/SuggestionsPanel.tsx
git commit -m "feat: add 'Ask agent' action to home suggestion cards"
```

---

## Self-Review notes (for the implementer)

- **Spec §5 (port + event types):** Tasks 1, 7. **§6 (tool mechanics):** Task 6. **§7 (four tools):** Tasks 4–5. **§8 (notification surface):** Tasks 1–3. **§9.1 (ChatPanel approval):** Task 8. **§9.2 (home wiring):** Task 9. **§10 (testing):** unit tests in Tasks 2–6, manual acceptance in Tasks 7–9.
- **Green builds:** the `AgentService` interface keeps `stream()` through Task 7 (adapter implements both) and removes it in Task 8, so the codebase compiles after every task.
- **`create_task` reuses Spec 1's seam** exactly: `scheduleService.create({ kind:'task', source:'intervention', student_id, date: weekToDate(presentation, dueWeek), week, status:'open' })`.
- **Type consistency:** `AgentDeps`, `ToolExecResult`, `AnthropicResponse`, `ProposedAction`, `ApprovalDecision`, `AgentEvent` names match across Tasks 1, 5, 6, 7, 8. `WRITE_TOOLS` is the single source of which tools need approval (Task 5), consumed only by `runAgentLoop` (Task 6).
- **Non-streaming + model:** `runAgentLoop` sends `model: 'claude-sonnet-4-6'`, `tools`, no `stream` flag, no sampling params — per the global constraints.
