# Schedule & Tasks Foundation — Design Spec

**Date:** 2026-06-30
**Status:** Approved design, pending implementation plan
**Scope:** Spec 1 of 2. This is the "arms and legs" foundation. The agentic layer is **Spec 2 — Agentic Spine** (separate doc, built next).

---

## 1. Context & purpose

The teacher dashboard is a demo of **agentic** capability over the OULAD learning-analytics dataset. The agent is the "brain"; conventional features are the "arms and legs" it acts through. Before the agent can act, those features must exist as real, persistent, manually-usable surfaces.

This spec delivers that foundation: a **unified schedule + task model**, a **Weekly Schedule calendar**, and a **home page** with rule-based suggestions and a to-do list. It is independently demoable with **no agent involved**. Spec 2 plugs the agent into the `create_task` seam defined here.

## 2. Problem with the current state

There are **two conflicting schedule systems writing different shapes into the same `schedules` collection**:

1. `src/modules/class/components/ScheduleCrud.tsx` — real CRUD against flat `/api/schedules`; documents shaped `{ subject, classroom, date, type: 'Regular' | 'Makeup' }`. Date-based classes. Has a silent-failure bug (no error handling; fails invisibly when the API is down) and a plain unstyled HTML table.
2. `src/modules/dashboard/components/CourseSchedule.tsx` — reads `/api/schedules/:module/:presentation` but **ignores the response and renders client-generated mock** week-indexed lecture items (weeks 1..numWeeks with LMS links). Curriculum plan, not a calendar.

`GET /api/schedules` does `find({})`, so it returns documents of both shapes, rendering blank rows in the CRUD table. The two concepts (dated **classes** vs. week-indexed **curriculum**) must be reconciled.

## 3. Goals / Non-goals

**Goals**
- One unified `schedule_events` model holding **classes**, **lectures** (curriculum), and **tasks**.
- A Weekly Schedule calendar (Mon–Sun) rendering all three kinds, fully manually editable.
- A home page with deterministic, rule-based **suggestion cards** and a **to-do list** backed by persistent tasks.
- Replace the buggy `ScheduleCrud` table and absorb `CourseSchedule` into the unified model.
- Define the `create_task` write path that Spec 2's agent will reuse.

**Non-goals (deferred)**
- Any agent / LLM tool use, approval cards, or chat changes → **Spec 2**.
- Concept-graph features, assessment-chase loop, reporting/export.
- Real LMS integration for lecture materials (links remain static/placeholder).
- Multi-teacher accounts, auth changes.

## 4. Architecture overview

Follows the existing hexagonal layout (ports/adapters, DI container).

- **Server (Express, port 8000)** owns persistence in MongoDB collection `schedule_events`, exposing REST CRUD.
- **Client** gets a new `ScheduleService` **port** + `ApiScheduleAdapter` (fetches the Express API), registered in `src/di/container.ts` alongside the existing services. The OULAD analytics `DataService` is unchanged and is used **read-only** to compute suggestion signals.
- **Views**: new `WeeklyScheduleView` (evolves `ScheduleCrud`, absorbs `CourseSchedule`) and new `HomeView` (landing route).

```
HomeView ──┐                         ┌─ DataService (OULAD, read) → signal rules
           ├─ ScheduleService (port) ─┤
WeeklySch ─┘   = ApiScheduleAdapter ──┴─ Express /api/schedule-events → Mongo `schedule_events`
```

## 5. Data model

New domain type in `src/types/domain.ts`:

```ts
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
  date: string            // ISO datetime — the calendar axis (required for all kinds)
  week: number | null     // course week (lectures); null otherwise

  // class-only
  classroom?: string
  class_type?: ClassType

  // lecture-only
  materials_url?: string

  // task-only
  source?: TaskSource
  student_id?: number | null
  status?: TaskStatus
  linked_notification_id?: string | null

  created_at: string
}
```

One collection, `schedule_events`, replaces the flat `schedules` docs (→ `kind:'class'`), the per-course curriculum (→ `kind:'lecture'`), and the previously-planned `tasks` collection (→ `kind:'task'`).

## 6. Week ↔ date mapping

Lectures are week-numbered; the calendar needs absolute dates. Resolve with a per-presentation **anchor start date** in a small config map (`src/shared/scheduleAnchors.ts`):

```ts
// presentation code → ISO start date (Monday of course week 1)
export const PRESENTATION_ANCHORS: Record<string, string> = {
  '2013B': '2013-02-04', '2013J': '2013-10-07',
  '2014B': '2014-02-03', '2014J': '2014-10-06',
}
```

`weekToDate(presentation, week) = anchor + (week - 1) * 7 days`. Used to place lectures on the calendar and to default a task's date. Anchors are demo approximations, documented as such.

## 7. API routes (Express, `server/index.ts`)

Replace the four conflicting `/api/schedules*` routes with one resource:

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/schedule-events?module=&presentation=&kind=` | list, filtered by course and optional kind |
| POST | `/api/schedule-events` | create one event (validates required fields per kind) |
| PATCH | `/api/schedule-events/:id` | partial update (move date, edit fields, toggle task status) |
| DELETE | `/api/schedule-events/:id` | delete one event |

All handlers wrap in try/catch and return JSON errors (the current silent-failure mode is eliminated client-side too — see §8). Validation: every event requires `module`, `presentation`, `kind`, `title`, `date`; `class` requires `classroom` + `class_type`; `task` requires `source` + `status`.

**Old routes** (`GET/POST /api/schedules`, `PUT/DELETE /api/schedules/:id`, `GET/POST /api/schedules/:module/:presentation`) are removed.

## 8. Client services

New port `src/ports/ScheduleService.ts`:

```ts
export interface ScheduleService {
  list(module: string, presentation: string, kind?: ScheduleEventKind): Promise<ScheduleEvent[]>
  create(event: Omit<ScheduleEvent, '_id' | 'created_at'>): Promise<ScheduleEvent>
  update(id: string, patch: Partial<ScheduleEvent>): Promise<ScheduleEvent>
  remove(id: string): Promise<void>
}
```

`src/adapters/ApiScheduleAdapter.ts` implements it via `fetch` against `${VITE_API_BASE}`, with explicit error handling (throws on non-2xx; callers surface a visible error — no silent failures). Registered in `src/di/container.ts` as `scheduleService`.

`create_task` is just `scheduleService.create({ kind: 'task', ... })`. **This is the exact seam Spec 2's agent tool writes through.**

## 9. Views

### 9.1 WeeklyScheduleView (new; evolves ScheduleCrud, absorbs CourseSchedule)
- **Mon–Sun calendar grid** for the selected course/week (from `contextStore`: `selectedModule`, `selectedPresentation`, `currentWeek`).
- Renders all three kinds with distinct badges: 📅 class, 📖 lecture, 🎯 task(intervention), 💡 task(suggestion).
- **Manual editing**: create event (add dialog), edit (click event), move (change date), delete; tasks get a done/dismiss control (`PATCH status`). Editing a class writes `kind:'class'`; etc.
- Replaces the route currently served by `ScheduleCrud` inside `ClassView`; `CourseSchedule` is removed and its curriculum becomes `kind:'lecture'` events (seeded via §11).
- Built with MUI to match the rest of the app (no more raw HTML table / inline styles).

### 9.2 HomeView (new landing route `/`)
Two regions; the current class-overview dashboard moves from `/` to its own route (e.g. `/overview`) in `src/modules/registry.tsx`.

- **Suggested actions** — cards from deterministic signal rules (§10). Each card's primary action in **Spec 1**: create a `kind:'task'` event (persisted) defaulted onto the schedule, and reflect it in the to-do list. *(Spec 2 adds: also seed the chat and run the agent loop.)*
- **To-do list** — open tasks (`kind:'task'`, `status:'open'`) merged with upcoming `class`/`lecture` events, sorted by date, each with source badge and a done/dismiss control. Every task always has a `date` (defaulted on creation per §6 / the signal payload), so the to-do list and the Weekly Schedule show the same task — list view vs. calendar view of one store.

## 10. Suggestion signal rules (deterministic, client-side)

Computed from the OULAD `DataService` course data for the selected course at `currentWeek`. No randomness, no LLM.

1. **Tier escalation** — students whose `tier_by_week[currentWeek] > tier_by_week[currentWeek-1]` (risk got worse). Card: "N students escalated to a higher risk tier this week."
2. **Engagement drop** — students whose `decayed_engagement[currentWeek]` fell sharply vs their trailing average and sit below `cohort_p75_decayed[currentWeek]`. Card: "Student #X engagement dropped — check in."
3. **Assessment risk** — an assessment with `date_due` within the next 7 days where some students have no `date_submitted`. Card: "Assessment due in Nd · M not submitted."

Each rule yields zero or more cards with a title, a count/affected list, and a default task payload (title, date, optional `student_id`).

## 11. Migration / data cleanup

The `schedules` collection holds mixed legacy shapes. Since the dashboard data source is being moved to local JSON anyway and this is a demo, a one-time migration script (`scripts/migrate-schedule-events.ts`, run via `tsx`) will:
- read legacy flat docs → write `kind:'class'` events,
- drop legacy per-course docs (curriculum is regenerated as `kind:'lecture'` from the anchor map + a static lecture template, since `CourseSchedule` was mock anyway),
- leave the old `schedules` collection untouched (new collection is `schedule_events`), so rollback is trivial.

Lecture seeding: for each course in the OULAD index, generate `kind:'lecture'` events for weeks 1..num_weeks using `weekToDate` and a templated title; idempotent (keyed on module+presentation+week).

## 12. Testing

- **Unit (pure functions):** `weekToDate`; each signal rule over local JSON fixtures (deterministic, table-driven).
- **Adapter:** `ApiScheduleAdapter` against a mocked fetch — asserts error throwing on non-2xx (guards against the silent-failure regression).
- **Server:** route validation (rejects missing per-kind required fields) and CRUD round-trip against a test DB / in-memory mock.
- **Manual acceptance:** start `npm run server` + `npm run dev`; add/edit/move/delete a class on the calendar; a lecture renders on its anchored date; a signal card creates a task that appears on both the calendar and the to-do list; toggle the task done.

## 13. Out of scope → Spec 2 (Agentic Spine)

For continuity, Spec 2 will: upgrade `ClaudeAgentAdapter` from chat-only to a **tool loop**; add read tools (`list_at_risk_students`, `get_student_detail`) and write tools (`send_notification`, `create_task` → reuses §8); add **approve-each-write** proposed-action cards in `ChatPanel`; and wire §9.2 suggestion cards to seed the chat and run the loop. It writes tasks through the exact `ScheduleService.create` seam defined here, so no schedule/task code changes are needed in Spec 2.
