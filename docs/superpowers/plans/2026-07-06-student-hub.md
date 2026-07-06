# Student Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a master Student Management roster (all students across every course, filterable/sortable) plus a reusable student-detail presentation usable as a slide-over drawer (from any page) or a full page.

**Architecture:** Add `dataService.getAllCourses()` to load every course; extract the six existing prop-driven cards into a shared `StudentDetailContent`; host it in a state-driven `StudentDetailDrawer` (mounted once in `Shell`) and in the refactored `/student/:id` page; build `StudentManagementView` on pure `buildRoster` / `filterAndSortRoster` logic. Roster logic is TDD; UI is verified by tsc + build + manual.

**Tech Stack:** TypeScript (strict), React 18, MUI v5, Zustand (`contextStore`), React Router, @tanstack/react-query, Vite 5, Vitest.

## Global Constraints

- TypeScript strict; no `any` except `as any` on mocked fetch in tests.
- Domain time-series arrays are indexed `0 = week 1`; course week `W` is array index `W - 1`.
- Do NOT change the six card components' internals or the notes/mastery data model.
- The roster is **global**: each row carries its own `module`/`presentation`; opening a student's detail uses THAT student's course (never the globally-selected one) and reuses the already-loaded `StudentProfile` (no refetch).
- `contextStore` field names added this spec: `detailTarget`, `openStudentDetail`, `closeStudentDetail` (exact).
- MUI v5 only. Commit after each task with the message in its final step.
- Verification: `npx tsc --noEmit` (exit 0) + `npx vite build` (success) + `npx vitest run` (all pass). Pure logic (Tasks 1–2) is TDD; UI (Tasks 3–5) is tsc + build + manual.

---

## File Structure

**Create:**
- `src/modules/students/roster.ts` — `RosterRow`/`RosterFilters`/`RosterSort` + `buildRoster` + `filterAndSortRoster` (pure).
- `src/modules/students/roster.test.ts`
- `src/modules/students/views/StudentManagementView.tsx` — the `/students` roster page.
- `src/modules/student/components/StudentDetailContent.tsx` — shared card grid.
- `src/modules/student/components/StudentDetailDrawer.tsx` — right slide-over host.
- `src/adapters/ProcessedDataAdapter.test.ts` — `getAllCourses` test.

**Modify:**
- `src/ports/DataService.ts` — add `getAllCourses()`.
- `src/adapters/ProcessedDataAdapter.ts` + `src/adapters/MongoDataAdapter.ts` — implement it.
- `src/shared/stores/contextStore.ts` — drawer state.
- `src/modules/student/views/StudentDetailView.tsx` — reuse `StudentDetailContent`.
- `src/shared/components/Shell.tsx` — mount `StudentDetailDrawer`.
- `src/App.tsx` — `/students` route.
- `src/modules/registry.tsx` — replace `Student detail` nav with `Student Management`.

---

## Task 1: `dataService.getAllCourses()`

**Files:**
- Modify: `src/ports/DataService.ts`, `src/adapters/ProcessedDataAdapter.ts`, `src/adapters/MongoDataAdapter.ts`
- Test: `src/adapters/ProcessedDataAdapter.test.ts`

**Interfaces:**
- Consumes: existing `getIndex()`, `getCourse(module, presentation)`.
- Produces: `DataService.getAllCourses(): Promise<ProcessedCourse[]>`.

- [ ] **Step 1: Write the failing test `src/adapters/ProcessedDataAdapter.test.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProcessedDataAdapter } from './ProcessedDataAdapter'

beforeEach(() => { vi.restoreAllMocks() })

describe('ProcessedDataAdapter.getAllCourses', () => {
  it('returns one processed course per index entry', async () => {
    const index = { courses: [
      { module: 'AAA', presentation: '2013J', num_weeks: 39, student_count: 1 },
      { module: 'BBB', presentation: '2013J', num_weeks: 39, student_count: 1 },
    ] }
    const course = (module: string) => ({ module, presentation: '2013J', num_weeks: 39, students: [], cohort_p75_decayed: [] })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('index.json')) return { ok: true, json: async () => index } as unknown as Response
      const mod = url.includes('AAA') ? 'AAA' : 'BBB'
      return { ok: true, json: async () => course(mod) } as unknown as Response
    }))
    const all = await new ProcessedDataAdapter().getAllCourses()
    expect(all).toHaveLength(2)
    expect(all.map((c) => c.module).sort()).toEqual(['AAA', 'BBB'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/adapters/ProcessedDataAdapter.test.ts`
Expected: FAIL — `getAllCourses` is not a function.

- [ ] **Step 3: Add `getAllCourses` to the port `src/ports/DataService.ts`**

Add inside the `DataService` interface:
```ts
  /** Returns full processed data for every course in the index. */
  getAllCourses(): Promise<ProcessedCourse[]>
```

- [ ] **Step 4: Implement in `src/adapters/ProcessedDataAdapter.ts`**

Add this method to the `ProcessedDataAdapter` class:
```ts
  async getAllCourses(): Promise<ProcessedCourse[]> {
    const idx = await this.getIndex()
    return Promise.all(idx.courses.map((c) => this.getCourse(c.module, c.presentation)))
  }
```

- [ ] **Step 5: Implement in `src/adapters/MongoDataAdapter.ts`**

Add the identical method to the `MongoDataAdapter` class (it reuses that class's own `getIndex`/`getCourse`):
```ts
  async getAllCourses(): Promise<ProcessedCourse[]> {
    const idx = await this.getIndex()
    return Promise.all(idx.courses.map((c) => this.getCourse(c.module, c.presentation)))
  }
```
Ensure `ProcessedCourse` is imported in `MongoDataAdapter.ts` (it is already used by `getCourse`'s return type).

- [ ] **Step 6: Run the test + type-check**

Run: `npx vitest run src/adapters/ProcessedDataAdapter.test.ts && npx tsc --noEmit`
Expected: test PASS (1); tsc exit 0 (both adapters satisfy the interface).

- [ ] **Step 7: Commit**

```bash
git add src/ports/DataService.ts src/adapters/ProcessedDataAdapter.ts src/adapters/MongoDataAdapter.ts src/adapters/ProcessedDataAdapter.test.ts
git commit -m "feat: add dataService.getAllCourses across the index"
```

---

## Task 2: Roster pure logic

**Files:**
- Create: `src/modules/students/roster.ts`
- Test: `src/modules/students/roster.test.ts`

**Interfaces:**
- Consumes: `ProcessedCourse`, `StudentProfile` (domain).
- Produces:
  - `interface RosterRow { id_student: number; module: string; presentation: string; tier: number; risk: number; decayed_engagement: number; final_result: string }`
  - `interface RosterFilters { module?: string; presentation?: string; tier?: number; final_result?: string; search?: string }`
  - `interface RosterSort { key: 'tier' | 'risk' | 'decayed_engagement' | 'id_student'; dir: 'asc' | 'desc' }`
  - `buildRoster(courses: ProcessedCourse[], week: number): RosterRow[]`
  - `filterAndSortRoster(rows: RosterRow[], filters: RosterFilters, sort: RosterSort): RosterRow[]`

- [ ] **Step 1: Write the failing test `src/modules/students/roster.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildRoster, filterAndSortRoster } from './roster'
import type { ProcessedCourse, StudentProfile } from '../../types/domain'

function student(id: number, over: Partial<StudentProfile>): StudentProfile {
  return {
    id_student: id, gender: 'M', region: 'r', highest_education: 'e', imd_band: 'b',
    age_band: 'a', num_of_prev_attempts: 0, studied_credits: 60, disability: false,
    final_result: 'Pass', date_registration: -30, date_unregistration: null,
    weekly_clicks: [], decayed_engagement: [], assessments: [],
    risk_by_week: [], tier_by_week: [], lstm_trajectories: null, ...over,
  }
}
function course(module: string, students: StudentProfile[]): ProcessedCourse {
  return { module, presentation: '2013J', num_weeks: 39, cohort_p75_decayed: [], students }
}

// week 3 -> index 2
const courses: ProcessedCourse[] = [
  course('AAA', [student(11, { tier_by_week: [1, 2, 3], risk_by_week: [0.1, 0.4, 0.8], decayed_engagement: [80, 40, 10], final_result: 'Fail' })]),
  course('BBB', [student(22, { tier_by_week: [1, 1, 1], risk_by_week: [0.1, 0.1, 0.2], decayed_engagement: [70, 70, 60], final_result: 'Pass' })]),
]

describe('buildRoster', () => {
  it('flattens all courses using week-indexed values', () => {
    const rows = buildRoster(courses, 3)
    expect(rows).toHaveLength(2)
    const a = rows.find((r) => r.id_student === 11)!
    expect(a).toMatchObject({ module: 'AAA', tier: 3, risk: 0.8, decayed_engagement: 10, final_result: 'Fail' })
  })
})

describe('filterAndSortRoster', () => {
  const rows = buildRoster(courses, 3)
  it('filters by module', () => {
    expect(filterAndSortRoster(rows, { module: 'BBB' }, { key: 'risk', dir: 'desc' })).toHaveLength(1)
  })
  it('filters by tier and final_result', () => {
    expect(filterAndSortRoster(rows, { tier: 3 }, { key: 'risk', dir: 'desc' })[0].id_student).toBe(11)
    expect(filterAndSortRoster(rows, { final_result: 'Pass' }, { key: 'risk', dir: 'desc' })[0].id_student).toBe(22)
  })
  it('filters by id substring search', () => {
    expect(filterAndSortRoster(rows, { search: '22' }, { key: 'risk', dir: 'desc' })).toHaveLength(1)
  })
  it('sorts by risk descending then ascending', () => {
    expect(filterAndSortRoster(rows, {}, { key: 'risk', dir: 'desc' }).map((r) => r.id_student)).toEqual([11, 22])
    expect(filterAndSortRoster(rows, {}, { key: 'risk', dir: 'asc' }).map((r) => r.id_student)).toEqual([22, 11])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/students/roster.test.ts`
Expected: FAIL — cannot resolve `./roster`.

- [ ] **Step 3: Implement `src/modules/students/roster.ts`**

```ts
import type { ProcessedCourse } from '../../types/domain'

export interface RosterRow {
  id_student: number
  module: string
  presentation: string
  tier: number
  risk: number
  decayed_engagement: number
  final_result: string
}

export interface RosterFilters {
  module?: string
  presentation?: string
  tier?: number
  final_result?: string
  search?: string
}

export interface RosterSort {
  key: 'tier' | 'risk' | 'decayed_engagement' | 'id_student'
  dir: 'asc' | 'desc'
}

// Domain arrays are 0-indexed at week 1, so week W is index W - 1.
const at = <T>(arr: T[], week: number): T | undefined => arr[week - 1]

export function buildRoster(courses: ProcessedCourse[], week: number): RosterRow[] {
  const rows: RosterRow[] = []
  for (const c of courses) {
    for (const s of c.students) {
      rows.push({
        id_student: s.id_student,
        module: c.module,
        presentation: c.presentation,
        tier: at(s.tier_by_week, week) ?? 1,
        risk: at(s.risk_by_week, week) ?? 0,
        decayed_engagement: at(s.decayed_engagement, week) ?? 0,
        final_result: s.final_result,
      })
    }
  }
  return rows
}

export function filterAndSortRoster(rows: RosterRow[], filters: RosterFilters, sort: RosterSort): RosterRow[] {
  const filtered = rows.filter((r) => {
    if (filters.module && r.module !== filters.module) return false
    if (filters.presentation && r.presentation !== filters.presentation) return false
    if (filters.tier != null && r.tier !== filters.tier) return false
    if (filters.final_result && r.final_result !== filters.final_result) return false
    if (filters.search && !String(r.id_student).includes(filters.search.trim())) return false
    return true
  })
  const factor = sort.dir === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    return av < bv ? -factor : av > bv ? factor : 0
  })
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/students/roster.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/students/roster.ts src/modules/students/roster.test.ts
git commit -m "feat: add roster build/filter/sort logic"
```

---

## Task 3: Shared `StudentDetailContent` + refactor the full page

**Files:**
- Create: `src/modules/student/components/StudentDetailContent.tsx`
- Modify: `src/modules/student/views/StudentDetailView.tsx`

**Interfaces:**
- Consumes: the six card components.
- Produces: `StudentDetailContent({ student: StudentProfile; module: string; presentation: string; currentWeek: number })`.

> UI refactor — verified by `tsc` + `vite build`.

- [ ] **Step 1: Create `src/modules/student/components/StudentDetailContent.tsx`**

```tsx
import { Grid } from '@mui/material'
import type { StudentProfile } from '../../../types/domain'
import { StudentDemographicsCard } from './StudentDemographicsCard'
import { RiskTrajectoryChart } from './RiskTrajectoryChart'
import { VleActivityChart } from './VleActivityChart'
import { AssessmentPanel } from './AssessmentPanel'
import { StudentNotesCard } from './StudentNotesCard'
import { MasteryGraphCard } from './MasteryGraphCard'

export interface StudentDetailContentProps {
  student: StudentProfile
  module: string
  presentation: string
  currentWeek: number
}

export function StudentDetailContent({ student, module, currentWeek }: StudentDetailContentProps) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          <Grid item xs={12}><StudentDemographicsCard student={student} /></Grid>
          <Grid item xs={12}><StudentNotesCard studentId={student.id_student} /></Grid>
        </Grid>
      </Grid>
      <Grid item xs={12} md={8}>
        <Grid container spacing={2}>
          <Grid item xs={12}><RiskTrajectoryChart student={student} currentWeek={currentWeek} /></Grid>
          <Grid item xs={12}><VleActivityChart student={student} currentWeek={currentWeek} /></Grid>
          <Grid item xs={12}><AssessmentPanel student={student} currentWeek={currentWeek} /></Grid>
          <Grid item xs={12}><MasteryGraphCard student={student} module={module} /></Grid>
        </Grid>
      </Grid>
    </Grid>
  )
}
```
(`presentation` is part of the props for host headers/consistency; the cards don't consume it, so it is intentionally not destructured — the project's tsconfig has `noUnusedParameters` off.)

- [ ] **Step 2: Refactor `src/modules/student/views/StudentDetailView.tsx` to use it**

Replace the card imports and the inner `<Grid container spacing={2}>…</Grid>` block. Remove the six card imports and the `Grid` import if now unused; add:
```tsx
import { StudentDetailContent } from '../components/StudentDetailContent'
```
Replace the entire `<Box sx={{ flex: 1, overflow: 'auto', p: 3 }}> … </Box>` body's inner grid with:
```tsx
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <StudentDetailContent
          student={student}
          module={selectedModule}
          presentation={selectedPresentation}
          currentWeek={currentWeek}
        />
      </Box>
```
Keep everything else (the `useParams`/`useQuery` fetch, the loading/not-found states, and the toolbar with the back button + "Discuss with AI") unchanged.

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npx vite build`
Expected: tsc exit 0; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/modules/student/components/StudentDetailContent.tsx src/modules/student/views/StudentDetailView.tsx
git commit -m "feat: extract shared StudentDetailContent and reuse in full-page view"
```

---

## Task 4: Drawer state + `StudentDetailDrawer` + Shell mount

**Files:**
- Modify: `src/shared/stores/contextStore.ts`
- Create: `src/modules/student/components/StudentDetailDrawer.tsx`
- Modify: `src/shared/components/Shell.tsx`

**Interfaces:**
- Consumes: `StudentDetailContent` (Task 3); `contextStore`.
- Produces: `contextStore.detailTarget` / `openStudentDetail` / `closeStudentDetail`; `StudentDetailDrawer` component.

> UI — verified by `tsc` + `vite build`.

- [ ] **Step 1: Add drawer state to `src/shared/stores/contextStore.ts`**

Add to the `ContextState` interface (after `chatPanelOpen`):
```ts
  detailTarget: { student: StudentProfile; module: string; presentation: string } | null
```
and (after `setChatPanelOpen`):
```ts
  openStudentDetail: (t: { student: StudentProfile; module: string; presentation: string }) => void
  closeStudentDetail: () => void
```
Add to the store body:
```ts
  detailTarget: null,
  openStudentDetail: (detailTarget) => set({ detailTarget }),
  closeStudentDetail: () => set({ detailTarget: null }),
```
(`StudentProfile` is already imported in this file.)

- [ ] **Step 2: Create `src/modules/student/components/StudentDetailDrawer.tsx`**

```tsx
import { Drawer, Box, Typography, IconButton, Button } from '@mui/material'
import CloseIcon from '@mui/icons-material/CloseRounded'
import ChatIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import { tokens } from '../../../theme'
import { useContextStore } from '../../../shared/stores/contextStore'
import { StudentDetailContent } from './StudentDetailContent'

export function StudentDetailDrawer() {
  const { detailTarget, closeStudentDetail, currentWeek, setActiveStudent, setChatPanelOpen } = useContextStore()

  function discuss() {
    if (!detailTarget) return
    setActiveStudent(detailTarget.student)
    setChatPanelOpen(true)
    closeStudentDetail()
  }

  return (
    <Drawer
      anchor="right"
      open={detailTarget != null}
      onClose={closeStudentDetail}
      PaperProps={{ sx: { width: { xs: '100%', sm: 720 }, maxWidth: '100%' } }}
    >
      {detailTarget && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 1.5, borderBottom: `1px solid ${tokens.border.default}`, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
              Student #{detailTarget.student.id_student} — {detailTarget.module} {detailTarget.presentation}
            </Typography>
            <Button size="small" variant="contained" startIcon={<ChatIcon />} onClick={discuss}
              sx={{ fontSize: 12, bgcolor: tokens.brand.primary, '&:hover': { bgcolor: tokens.brand.primaryDark } }}>
              Discuss with AI
            </Button>
            <IconButton size="small" onClick={closeStudentDetail}><CloseIcon fontSize="small" /></IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <StudentDetailContent
              student={detailTarget.student}
              module={detailTarget.module}
              presentation={detailTarget.presentation}
              currentWeek={currentWeek}
            />
          </Box>
        </Box>
      )}
    </Drawer>
  )
}
```

- [ ] **Step 3: Mount the drawer once in `src/shared/components/Shell.tsx`**

Add the import near the other component imports:
```tsx
import { StudentDetailDrawer } from '../../modules/student/components/StudentDetailDrawer'
```
Render `<StudentDetailDrawer />` as the last child inside the Shell's outermost returned element (a sibling of the sidebar `Drawer` and the `<Box component="main">`), so it overlays every page. For example, immediately before the closing tag of the root container:
```tsx
      <StudentDetailDrawer />
```

- [ ] **Step 4: Type-check and build**

Run: `npx tsc --noEmit && npx vite build`
Expected: tsc exit 0; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/shared/stores/contextStore.ts src/modules/student/components/StudentDetailDrawer.tsx src/shared/components/Shell.tsx
git commit -m "feat: add student-detail drawer state and slide-over host in Shell"
```

---

## Task 5: `StudentManagementView` (roster page) + route + registry

**Files:**
- Create: `src/modules/students/views/StudentManagementView.tsx`
- Modify: `src/App.tsx`, `src/modules/registry.tsx`

**Interfaces:**
- Consumes: `dataService.getAllCourses()` (Task 1); `buildRoster`/`filterAndSortRoster`/`RosterRow`/`RosterFilters`/`RosterSort` (Task 2); `contextStore.openStudentDetail` (Task 4).
- Produces: `StudentManagementView` routed at `/students`.

> UI — verified by `tsc` + `vite build` + `vitest` + manual.

- [ ] **Step 1: Create `src/modules/students/views/StudentManagementView.tsx`**

```tsx
import { useMemo, useState } from 'react'
import {
  Box, Typography, FormControl, InputLabel, Select, MenuItem, TextField,
  Table, TableHead, TableRow, TableCell, TableBody, TableSortLabel, Chip, Alert, CircularProgress,
} from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { buildRoster, filterAndSortRoster, type RosterRow, type RosterFilters, type RosterSort } from '../roster'
import type { StudentProfile } from '../../../types/domain'

const TIER_COLORS: Record<number, string> = { 1: '#1D9E75', 2: '#ef6c00', 3: '#c62828' }

export function StudentManagementView() {
  const { currentWeek, openStudentDetail } = useContextStore()
  const { data: courses, isLoading, error } = useQuery({
    queryKey: ['all-courses'],
    queryFn: () => container.dataService.getAllCourses(),
  })

  const [filters, setFilters] = useState<RosterFilters>({})
  const [sort, setSort] = useState<RosterSort>({ key: 'tier', dir: 'desc' })

  const rows = useMemo(() => (courses ? buildRoster(courses, currentWeek) : []), [courses, currentWeek])
  const visible = useMemo(() => filterAndSortRoster(rows, filters, sort), [rows, filters, sort])

  const studentIndex = useMemo(() => {
    const m = new Map<string, { student: StudentProfile; module: string; presentation: string }>()
    for (const c of courses ?? []) {
      for (const s of c.students) m.set(`${c.module}/${c.presentation}/${s.id_student}`, { student: s, module: c.module, presentation: c.presentation })
    }
    return m
  }, [courses])

  const moduleOptions = useMemo(() => [...new Set(rows.map((r) => r.module))].sort(), [rows])
  const resultOptions = useMemo(() => [...new Set(rows.map((r) => r.final_result))].sort(), [rows])

  function openRow(r: RosterRow) {
    const t = studentIndex.get(`${r.module}/${r.presentation}/${r.id_student}`)
    if (t) openStudentDetail(t)
  }

  function toggleSort(key: RosterSort['key']) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }))
  }

  function header(key: RosterSort['key'], label: string) {
    return (
      <TableSortLabel active={sort.key === key} direction={sort.key === key ? sort.dir : 'desc'} onClick={() => toggleSort(key)}>
        {label}
      </TableSortLabel>
    )
  }

  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">Failed to load students.</Alert></Box>

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Student Management · Week {currentWeek}</Typography>

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Course</InputLabel>
          <Select label="Course" value={filters.module ?? ''} onChange={(e) => setFilters((f) => ({ ...f, module: e.target.value || undefined }))}>
            <MenuItem value="">All</MenuItem>
            {moduleOptions.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Tier</InputLabel>
          <Select label="Tier" value={filters.tier ?? ''} onChange={(e) => setFilters((f) => ({ ...f, tier: e.target.value === '' ? undefined : Number(e.target.value) }))}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value={1}>1</MenuItem>
            <MenuItem value={2}>2</MenuItem>
            <MenuItem value={3}>3</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Final result</InputLabel>
          <Select label="Final result" value={filters.final_result ?? ''} onChange={(e) => setFilters((f) => ({ ...f, final_result: e.target.value || undefined }))}>
            <MenuItem value="">All</MenuItem>
            {resultOptions.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField size="small" label="Search id" value={filters.search ?? ''} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))} />
      </Box>

      {isLoading && <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', p: 2 }}><CircularProgress size={18} /><Typography sx={{ fontSize: 13 }}>Loading students…</Typography></Box>}

      {!isLoading && (
        <>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>{visible.length} students</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{header('id_student', 'Student')}</TableCell>
                <TableCell>Course</TableCell>
                <TableCell>{header('tier', 'Tier')}</TableCell>
                <TableCell>{header('risk', 'Risk')}</TableCell>
                <TableCell>{header('decayed_engagement', 'Engagement')}</TableCell>
                <TableCell>Final result</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={`${r.module}/${r.presentation}/${r.id_student}`} hover sx={{ cursor: 'pointer' }} onClick={() => openRow(r)}>
                  <TableCell>#{r.id_student}</TableCell>
                  <TableCell>{r.module} {r.presentation}</TableCell>
                  <TableCell><Chip label={r.tier} size="small" sx={{ bgcolor: `${TIER_COLORS[r.tier] ?? '#999'}22`, color: TIER_COLORS[r.tier] ?? '#999', height: 20, fontSize: 11 }} /></TableCell>
                  <TableCell>{(r.risk * 100).toFixed(0)}%</TableCell>
                  <TableCell>{r.decayed_engagement.toFixed(0)}</TableCell>
                  <TableCell>{r.final_result}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  )
}
```

- [ ] **Step 2: Add the `/students` route in `src/App.tsx`**

Add the import near the other view imports:
```tsx
import { StudentManagementView } from './modules/students/views/StudentManagementView'
```
Add the route (alongside the existing student routes):
```tsx
        <Route path="/students" element={<StudentManagementView />} />
```
Leave `/student/:id` and `/student` unchanged.

- [ ] **Step 3: Replace the nav entry in `src/modules/registry.tsx`**

Change the `student` entry to the Student Management entry (keep `PersonIcon`):
```tsx
  { id: 'students', label: 'Student Management', path: '/students', icon: <PersonIcon fontSize="small" /> },
```
(Replace the existing `{ id: 'student', label: 'Student detail', path: '/student', … }` line; keep the Home / Weekly Schedule / Class entries.)

- [ ] **Step 4: Type-check, build, and run the suite**

Run: `npx tsc --noEmit && npx vite build && npx vitest run`
Expected: tsc exit 0; build succeeds; all tests pass.

- [ ] **Step 5: Manual verification**

Run `npm run server` + `npm run dev`:
1. Sidebar shows **Student Management**; it lists students from every course.
2. Course / Tier / Final-result filters narrow the list; id search filters; clicking a sortable column header reorders.
3. Clicking a row opens the right slide-over drawer showing that student's cards for **their** course (module/presentation shown in the drawer header).
4. The drawer's "Discuss with AI" sets the chat's active student and opens the chat.
5. `/student/12` (direct URL) still renders the full-page detail via the shared content.

- [ ] **Step 6: Commit**

```bash
git add src/modules/students/views/StudentManagementView.tsx src/App.tsx src/modules/registry.tsx
git commit -m "feat: add global Student Management roster page with filters and detail drawer"
```

---

## Self-Review notes (for the implementer)

- **Spec §5 (getAllCourses):** Task 1. **§6 (StudentDetailContent):** Task 3. **§7 (drawer + store):** Task 4. **§8 (roster logic + view):** Tasks 2 + 5. **§9 (routing/registry/Shell mount):** Tasks 4–5. **§10 (testing):** unit in Tasks 1–2, manual in Tasks 3–5.
- **Green builds:** Task 1 keeps both adapters satisfying `DataService`; Tasks 3–5 each compile and the app runs after each. Nothing breaks mid-plan.
- **Global correctness:** the drawer opens from `openStudentDetail({ student, module, presentation })` built off the already-loaded `StudentProfile` (Task 5's `studentIndex`), so a student always shows their own course — never the globally-selected one (spec constraint).
- **Type consistency:** `RosterRow`/`RosterFilters`/`RosterSort` (Task 2) are consumed unchanged in Task 5; `detailTarget`/`openStudentDetail`/`closeStudentDetail` (Task 4) match the spec names and the drawer + view usage; `StudentDetailContentProps` (Task 3) is consumed by both the drawer (Task 4) and the full page (Task 3).
