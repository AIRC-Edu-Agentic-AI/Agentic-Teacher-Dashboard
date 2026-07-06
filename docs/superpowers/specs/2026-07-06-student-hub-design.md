# Student Hub — Design Spec

**Date:** 2026-07-06
**Status:** Approved design (IA-level), pending spec review + implementation plan
**Scope:** Sub-project 2 of 3 in the Information-Architecture Reorg. Builds on **SP1 — Nav Skeleton** (done). SP3 — Global Aggregation — follows.

---

## 1. Context & purpose

SP1 established the global-vs-course hierarchy and a global top bar. This sub-project builds the **student hub**: a single **master Student Management** page — a roster of all students across every course with filters — plus a reusable **student detail** presentation that can be invoked as a **slide-over drawer** from anywhere (roster, Home watchlist, agent) or opened as a **full page** for deep work.

The six student-detail cards already exist and are prop-driven; the missing pieces are (a) a shared content component that composes them, (b) a drawer + full-page host for it, (c) the master roster with filtering/sorting, and (d) the data path to load students across all courses.

## 2. Current state

- **Cards** (`src/modules/student/components/`), all prop-driven:
  - `StudentDemographicsCard({ student })`, `StudentNotesCard({ studentId })`,
    `RiskTrajectoryChart({ student, currentWeek })`, `VleActivityChart({ student, currentWeek })`,
    `AssessmentPanel({ student, currentWeek })`, `MasteryGraphCard({ student, module })`.
- **`StudentDetailView`** (`/student/:id`, `/student`) fetches the student via `dataService.getStudent(selectedModule, selectedPresentation, id)` — tied to the **globally-selected** course — and lays the cards out in a `Grid` with a toolbar (back button, "Discuss with AI").
- **`dataService`** exposes `getIndex()`, `getCourse(module, presentation)`, `getStudent(module, presentation, id)`. No cross-course load.
- **`contextStore`** has `activeStudent`/`setActiveStudent` (used for chat context) and `setChatPanelOpen`. No drawer state.
- Nav registry has a `Student detail` entry → `/student`.

## 3. Goals / Non-goals

**Goals**
- `dataService.getAllCourses(): Promise<ProcessedCourse[]>` (load index → all courses) on the port + both adapters.
- Extract the card layout into a shared **`StudentDetailContent({ student, module, presentation, currentWeek })`**.
- **`StudentDetailDrawer`** (MUI right `Drawer`) hosting `StudentDetailContent`, driven by new `contextStore` drawer state; mounted once in `Shell`.
- **`StudentManagementView`** — global roster (all students × courses), sortable, with filters: course, risk tier, final result, and id search; row click opens the drawer.
- Refactor the `/student/:id` full page to reuse `StudentDetailContent` (DRY).
- Replace the `Student detail` nav entry with **`Student Management`** → `/students`.
- A pure, tested `filterAndSortRoster(...)` for the roster's list logic.

**Non-goals (deferred)**
- Home / Weekly Schedule cross-course aggregation (they may start using `getAllCourses`, but their redesign is **SP3**).
- New management *actions* on the roster beyond filter/sort/open (bulk messaging, exports) — future work.
- Changing the six cards' internals or the notes/mastery data model.

## 4. Architecture overview

Hexagonal as before. A new **roster module** (`src/modules/students/`) holds the master page and its pure list logic; the existing **student module** (`src/modules/student/`) keeps the cards and gains the shared `StudentDetailContent` + `StudentDetailDrawer`. The drawer is state-driven via `contextStore` so any page can open it without prop drilling.

```
StudentManagementView ──row click──▶ contextStore.openStudentDetail({student, module, presentation})
Home watchlist / agent ─────────────▶            │
                                                 ▼
Shell mounts <StudentDetailDrawer/> ── reads detailTarget ──▶ StudentDetailContent(cards)
/student/:id full page ─────────────── also renders ───────▶ StudentDetailContent(cards)
```

## 5. Data — `getAllCourses`

Add to `src/ports/DataService.ts`:
```ts
getAllCourses(): Promise<ProcessedCourse[]>
```
- `ProcessedDataAdapter`: `const idx = await this.getIndex(); return Promise.all(idx.courses.map(c => this.getCourse(c.module, c.presentation)))` (reuses the per-course in-memory cache already in that adapter).
- `MongoDataAdapter`: analogous — index then per-course fetch (reusing its existing `getCourse`).

~6 courses, cached, so this is a bounded fan-out.

## 6. Shared `StudentDetailContent`

New `src/modules/student/components/StudentDetailContent.tsx`:
```ts
interface StudentDetailContentProps {
  student: StudentProfile
  module: string
  presentation: string
  currentWeek: number
}
```
Renders the exact `Grid` layout currently inside `StudentDetailView` (Demographics + Notes on the left; Risk / VLE / Assessment / Mastery on the right), using the props (`MasteryGraphCard` gets `module` from props, not the global store). No toolbar — the host (drawer or page) supplies chrome. `StudentDetailView` is refactored to fetch the student, then render `<StudentDetailContent student module presentation currentWeek />` inside its existing toolbar shell.

## 7. Drawer + `contextStore` state

Add to `contextStore`:
```ts
detailTarget: { student: StudentProfile; module: string; presentation: string } | null
openStudentDetail: (t: { student: StudentProfile; module: string; presentation: string }) => void
closeStudentDetail: () => void
```
`StudentDetailDrawer` (`src/modules/student/components/StudentDetailDrawer.tsx`): a right-anchored MUI `Drawer`, `open={detailTarget != null}`, `onClose={closeStudentDetail}`, width ~720px, that renders a header (`Student #id — module presentation`, a "Discuss with AI" button that sets `activeStudent` + opens chat, a close button) above `StudentDetailContent`. Mounted once in `Shell` so it overlays every page. `currentWeek` comes from `contextStore`.

## 8. `StudentManagementView` (roster)

New module `src/modules/students/`:
- **`roster.ts`** — pure list logic:
  ```ts
  interface RosterRow {
    id_student: number; module: string; presentation: string
    tier: number; risk: number; decayed_engagement: number; final_result: string
  }
  interface RosterFilters {
    module?: string; presentation?: string; tier?: number; final_result?: string; search?: string
  }
  type RosterSort = { key: 'tier' | 'risk' | 'decayed_engagement' | 'id_student'; dir: 'asc' | 'desc' }
  function buildRoster(courses: ProcessedCourse[], week: number): RosterRow[]
  function filterAndSortRoster(rows: RosterRow[], filters: RosterFilters, sort: RosterSort): RosterRow[]
  ```
  `buildRoster` flattens every course's students into rows using the `week`-indexed tier/risk/engagement (`arr[week-1]`). `filterAndSortRoster` applies the filters (course, tier, final result, id substring) then sorts. Pure and deterministic → unit-tested.
- **`StudentManagementView.tsx`** (`/students`): loads `dataService.getAllCourses()`, builds rows at `currentWeek`, renders an MUI filter bar (course `Select` incl. "All", tier `Select`, final-result `Select`, id search `TextField`) + a sortable `Table`. Each row click calls `openStudentDetail({ student, module, presentation })` (the full `StudentProfile` is retained from the loaded course so the drawer needs no refetch). Column sort toggles `RosterSort`.

## 9. Routing & registry

- `src/App.tsx`: add `<Route path="/students" element={<StudentManagementView />} />`. Keep `/student/:id` and `/student` (full-page detail) unchanged in routing (now rendering the refactored view).
- `src/modules/registry.tsx`: replace the `student` entry with `{ id: 'students', label: 'Student Management', path: '/students', icon: <PersonIcon/> }`. (The full-page `/student/:id` stays reachable by direct URL / shareable link; it is no longer a top-level nav item.)
- `Shell`: mount `<StudentDetailDrawer />` once.

## 10. Testing

- **Unit (pure):** `buildRoster` (correct flattening + week-indexed tier/risk/engagement over fixtures) and `filterAndSortRoster` (each filter narrows correctly; sort orders by key/dir; id search is substring) — deterministic, table-driven.
- **Adapter:** `ProcessedDataAdapter.getAllCourses` returns one entry per index course (mocked `fetch`).
- **Manual acceptance:** `/students` lists students across all courses; filters narrow the list; sorting a column reorders it; clicking a row opens the slide-over drawer with that student's cards (correct course); the drawer's "Discuss with AI" sets the chat's active student; `/student/:id` full page still renders via the shared content.

## 11. Out of scope → SP3

SP3 makes **Home** aggregate suggestions/at-risk/to-dos across all courses (reusing `getAllCourses`) and **Weekly Schedule** list all events via a new `scheduleService.listAll()`, leaving the global week slider as the only shared course-independent control.
