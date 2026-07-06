# Global Aggregation — Design Spec

**Date:** 2026-07-06
**Status:** Approved design (IA-level + agenda decision), pending spec review + implementation plan
**Scope:** Sub-project 3 of 3 (final) in the Information-Architecture Reorg. Builds on **SP1 — Nav Skeleton** and **SP2 — Student Hub** (both done). Completes the reorg.

---

## 1. Context & purpose

SP1 relocated the course selector off the global bar; SP2 built the global student hub. This final sub-project makes the last two global pages actually global: **Home** aggregates its suggestions and to-dos across **all** courses, and **Weekly Schedule** becomes an **all-course agenda** (a chronological list of every event, tagged by course) instead of a single-course Mon–Sun grid. After this, no page depends on the module/presentation selection except the course-scoped `Class` workspace and the `Student Management` course filter.

**Why an agenda, not a grid:** courses span different academic years (2013J, 2014J, 2013B, 2014B) with distinct start anchors, so a single calendar week only ever contains one course's events — a "global calendar week" is degenerate. A chronological agenda across courses is the meaningful global form.

## 2. Current state

- `SuggestionsPanel` (`src/modules/home/components/SuggestionsPanel.tsx`) runs `computeSuggestions(course, currentWeek)` for the **one** globally-selected course and, on accept, creates a `kind:'task'` event for that course.
- `TodoList` (`src/modules/home/components/TodoList.tsx`) calls `scheduleService.list(selectedModule, selectedPresentation)`, filters to open tasks + upcoming class/lecture, sorts by date.
- `WeeklyScheduleView` (`src/modules/schedule/views/WeeklyScheduleView.tsx`) is a Mon–Sun grid: it filters events to the selected course, buckets them into day columns via `weekRange(selectedPresentation, currentWeek)`, and supports create/edit/delete + task done/dismiss through `ScheduleEventDialog` (which takes the course from `{module: selectedModule, presentation: selectedPresentation}`).
- `ScheduleService` exposes `list(module, presentation, kind?)`, `create`, `update`, `remove`. The server `GET /api/schedule-events` already returns **all** events when no `module`/`presentation` query is given.
- SP2 added `dataService.getAllCourses()`.

## 3. Goals / Non-goals

**Goals**
- `scheduleService.listAll(): Promise<ScheduleEvent[]>` (port + `ApiScheduleAdapter`), hitting the unfiltered `GET /api/schedule-events`.
- **Home global:** `SuggestionsPanel` aggregates signal cards across all courses (each card tagged with its course; accept creates the task for that course); `TodoList` uses `listAll()` and shows open tasks + upcoming class/lecture across all courses, each tagged with its course.
- **Weekly Schedule → agenda:** replace the grid with a **week-slider-driven agenda** across all courses — a **This week** section and an **Upcoming (this month)** section — where each event's window is computed from *its own* course anchor (so week N aggregates correctly across the different course years). Each row tagged with its course; keep task done/dismiss and edit/delete of existing events; keep create-new via `ScheduleEventDialog` with an in-dialog course picker (since there's no global course anymore).
- Pure, tested helpers: `aggregateSuggestions(courses, week)` and `buildAgenda(events, week)`.

**Non-goals (deferred)**
- The two SP2 follow-ups (`Promise.allSettled` resilience in `getAllCourses`; out-of-range-week guard) — tracked separately.
- Per-course "current week" model — the global week slider stays a single viewing position used by the course-scoped analytics + Home signal rules.
- Calendar/month views, drag-to-reschedule.

## 4. Architecture overview

Hexagonal as before. Home components switch from single-course to all-course data via `getAllCourses()` / `listAll()`, with two new pure helpers holding the aggregation/grouping logic (unit-tested). `WeeklyScheduleView` is rewritten as an agenda over `listAll()`; `ScheduleEventDialog` gains a create-mode course picker so event creation still works without a global course.

## 5. `scheduleService.listAll`

Add to `src/ports/ScheduleService.ts`:
```ts
listAll(): Promise<ScheduleEvent[]>
```
`ApiScheduleAdapter.listAll()`: `handle<ScheduleEvent[]>(await fetch(\`${API_BASE}/schedule-events\`))` (no query params → server returns all, newest-first by its existing sort; the agenda re-sorts ascending by date). Same `handle<T>` throw-on-non-2xx pattern as the rest of the adapter.

## 6. Home — global suggestions + to-do

### 6.1 `aggregateSuggestions` (pure, `src/modules/schedule/signals/suggestionRules.ts`)
```ts
export interface CourseSuggestion { card: SuggestionCard; module: string; presentation: string }
export function aggregateSuggestions(courses: ProcessedCourse[], week: number): CourseSuggestion[]
```
Runs the existing `computeSuggestions(course, week)` for each course and tags every resulting card with that course's `module`/`presentation`. Deterministic → unit-tested.

### 6.2 `SuggestionsPanel`
- Loads `dataService.getAllCourses()`, computes `aggregateSuggestions(courses, currentWeek)`.
- Each card shows its course (e.g. a small `AAA · 2013J` chip). **Accept** creates the `kind:'task'` event using **that card's** `module`/`presentation` (and `weekToDate(presentation, currentWeek)`), not any global selection. **Ask agent** seeds the prompt as today but also sets the global course to the card's course first (so the agent's context matches, mirroring SP2's drawer fix).
- Empty state unchanged.

### 6.3 `TodoList`
- Loads `scheduleService.listAll()`; shows **all open tasks** across courses (any week) plus **classes/lectures in the current-week+month window** (via the shared `inCourseWindow` predicate, §7.1), merged and sorted by date; each row gains a course tag (`module presentation`). No selected-course dependency; driven by the week slider for the class/lecture portion.

## 7. Weekly Schedule → week-driven agenda

### 7.1 `buildAgenda` (pure, `src/modules/schedule/agenda.ts`)
```ts
export interface AgendaBuckets { thisWeek: ScheduleEvent[]; thisMonth: ScheduleEvent[] }

/** True if event e falls in [week+fromWeek, week+toWeek) of ITS OWN course anchor. */
export function inCourseWindow(e: ScheduleEvent, week: number, fromWeek: number, toWeek: number): boolean

export function buildAgenda(events: ScheduleEvent[], week: number): AgendaBuckets
```
`inCourseWindow` returns `false` for a presentation with no anchor; otherwise compares `new Date(e.date)` against `[weekToDate(e.presentation, week+fromWeek), weekToDate(e.presentation, week+toWeek))`. `buildAgenda` returns `thisWeek = events in window [0,1)` and `thisMonth = events in window [1,4)` (the following ~4 weeks), each sorted ascending by `date`. Because every event uses **its own** course anchor, week N resolves to the right calendar window per course/year. Deterministic → unit-tested.

### 7.2 `WeeklyScheduleView` (rewrite to week-driven agenda)
- Loads `scheduleService.listAll()`, computes `buildAgenda(events, currentWeek)`, and renders two labelled sections — **This week (week N)** and **Upcoming · next 4 weeks** — as flat date-sorted rows. Each row: `eventBadge` emoji + label, title, the event's date, and a **course chip** (`module presentation`).
- Tasks (`kind:'task'`, `status:'open'`) keep **Done / Dismiss** (`scheduleService.update`). Any row opens `ScheduleEventDialog` for **edit/delete** (prefilled from that event's own `module`/`presentation`).
- An **Add event** button opens the dialog in create mode.
- Errors surface via an `Alert` (no silent failures), consistent with SP1/SP2.
- The Mon–Sun grid and the day-bucketing logic are removed; both agenda sections are driven by the global week slider (`currentWeek`).

### 7.3 `ScheduleEventDialog` — create-mode course picker
Because there's no global course on the agenda, the dialog must know which course a *new* event belongs to:
- On **create** (`!initial?._id`): render Module + Presentation `<Select>`s (populated from `dataService.getIndex()`), held in local dialog state, and include the chosen `module`/`presentation` in the saved event.
- On **edit**: the course is fixed (from the event); no picker shown.
- The `onSave` payload shape is unchanged (`Omit<ScheduleEvent,'_id'|'created_at'>`); only where `module`/`presentation` come from changes.

## 8. Testing

- **Unit (pure):** `aggregateSuggestions` (tags each course's cards with its course; empty when no signals); `inCourseWindow` (event in/out of the per-course week window; unknown-anchor → false); `buildAgenda` (a week-N event lands in `thisWeek`, a week-N+2 event in `thisMonth`, both sorted ascending; events across two different course years both resolve correctly against week N) over fixtures.
- **Adapter:** `ApiScheduleAdapter.listAll` hits `/schedule-events` with no query and throws on non-2xx (mocked fetch).
- **Manual acceptance:** with `npm run server` + `npm run dev` — Home suggestions show cards from multiple courses (course-chipped) and accepting one creates a task in the right course; the to-do list spans courses; the Weekly Schedule agenda shows **This week** + **Upcoming** sections driven by the week slider, aggregating events across course years; moving the slider changes what appears; task Done/Dismiss and event edit/delete work; adding an event via the dialog's course picker persists it and it appears in the agenda.

## 9. Completion

This finishes the IA reorg: **Global** = Home (aggregated), Weekly Schedule (all-course agenda), Student Management (roster); **Course-scoped** = Class workspace + the Student Management course filter; **Overlay** = the student-detail drawer. The global top bar retains only the viewing-week slider.
