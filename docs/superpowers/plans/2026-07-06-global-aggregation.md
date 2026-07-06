# Global Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Home aggregate suggestions/to-dos across all courses and turn Weekly Schedule into a week-slider-driven agenda (This week + next 4 weeks) that aggregates events across all courses by each event's own course anchor.

**Architecture:** Add `scheduleService.listAll()` (unfiltered events); two pure tested helpers — `aggregateSuggestions(courses, week)` and `agenda.ts` (`inCourseWindow` / `buildAgenda`); rewrite `SuggestionsPanel` + `TodoList` to load all courses/events; add a create-mode course picker to `ScheduleEventDialog`; rewrite `WeeklyScheduleView` from a Mon–Sun grid into the agenda. Pure logic is TDD; UI is tsc + build + manual.

**Tech Stack:** TypeScript (strict), React 18, MUI v5, Zustand (`contextStore`), @tanstack/react-query, Vite 5, Vitest.

## Global Constraints

- TypeScript strict; no `any` except `as any`/`as unknown as` on mocked fetch in tests.
- Domain time-series arrays are indexed `0 = week 1`; course week `W` is index `W - 1`.
- All client API calls throw on non-2xx (no silent failures); UI surfaces errors via `Alert`.
- The agenda is driven by the global week slider (`currentWeek`) and each event's OWN course anchor via `weekToDate(e.presentation, ...)`; it is NOT gated by real "now" (OULAD data is historical 2013–2014).
- Course chip text is `module presentation` (e.g. `AAA 2013J`).
- MUI v5 only. Commit after each task with the message in its final step.
- Verification: `npx tsc --noEmit` (exit 0) + `npx vite build` (success) + `npx vitest run` (all pass). Pure logic (Tasks 1–2) TDD; UI (Tasks 3–5) tsc + build + manual.

---

## File Structure

**Create:**
- `src/modules/schedule/agenda.ts` — `inCourseWindow` + `buildAgenda` (pure).
- `src/modules/schedule/agenda.test.ts`

**Modify:**
- `src/ports/ScheduleService.ts` — add `listAll()`.
- `src/adapters/ApiScheduleAdapter.ts` — implement `listAll()`.
- `src/adapters/ApiScheduleAdapter.test.ts` — add a `listAll` case.
- `src/modules/schedule/signals/suggestionRules.ts` — add `aggregateSuggestions` + `CourseSuggestion`.
- `src/modules/schedule/signals/suggestionRules.test.ts` — add `aggregateSuggestions` cases.
- `src/modules/home/components/SuggestionsPanel.tsx` — aggregate across courses.
- `src/modules/home/components/TodoList.tsx` — all-course, week-windowed.
- `src/modules/schedule/components/ScheduleEventDialog.tsx` — create-mode course picker.
- `src/modules/schedule/views/WeeklyScheduleView.tsx` — rewrite to agenda.

---

## Task 1: `scheduleService.listAll()`

**Files:**
- Modify: `src/ports/ScheduleService.ts`, `src/adapters/ApiScheduleAdapter.ts`
- Test: `src/adapters/ApiScheduleAdapter.test.ts`

**Interfaces:**
- Produces: `ScheduleService.listAll(): Promise<ScheduleEvent[]>`.

- [ ] **Step 1: Add a failing test case to `src/adapters/ApiScheduleAdapter.test.ts`**

Add this test inside the existing top-level `describe('ApiScheduleAdapter', …)` block:
```ts
  it('listAll fetches all events with no query params', async () => {
    const events = [{ _id: '1', module: 'AAA', presentation: '2013J', kind: 'class' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => events }))
    const result = await adapter.listAll()
    expect(result).toEqual(events)
    const url = (fetch as any).mock.calls[0][0] as string
    expect(url).toMatch(/\/schedule-events$/)
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/adapters/ApiScheduleAdapter.test.ts`
Expected: FAIL — `adapter.listAll is not a function`.

- [ ] **Step 3: Add `listAll` to the port `src/ports/ScheduleService.ts`**

Add to the `ScheduleService` interface (after `list`):
```ts
  listAll(): Promise<ScheduleEvent[]>
```

- [ ] **Step 4: Implement in `src/adapters/ApiScheduleAdapter.ts`**

Add this method to the `ApiScheduleAdapter` class (next to `list`), reusing the file's existing `handle<T>` helper and `API_BASE`:
```ts
  async listAll(): Promise<ScheduleEvent[]> {
    return handle<ScheduleEvent[]>(await fetch(`${API_BASE}/schedule-events`))
  }
```

- [ ] **Step 5: Run the test + type-check**

Run: `npx vitest run src/adapters/ApiScheduleAdapter.test.ts && npx tsc --noEmit`
Expected: tests PASS; tsc exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/ports/ScheduleService.ts src/adapters/ApiScheduleAdapter.ts src/adapters/ApiScheduleAdapter.test.ts
git commit -m "feat: add scheduleService.listAll for unfiltered events"
```

---

## Task 2: Pure aggregation helpers (`aggregateSuggestions` + agenda)

**Files:**
- Modify: `src/modules/schedule/signals/suggestionRules.ts` (append)
- Modify: `src/modules/schedule/signals/suggestionRules.test.ts` (append)
- Create: `src/modules/schedule/agenda.ts`
- Test: `src/modules/schedule/agenda.test.ts`

**Interfaces:**
- Consumes: `computeSuggestions`, `SuggestionCard` (existing); `ScheduleEvent`, `ProcessedCourse` (domain); `PRESENTATION_ANCHORS`, `weekToDate` (`src/shared/scheduleAnchors`).
- Produces:
  - `interface CourseSuggestion { card: SuggestionCard; module: string; presentation: string }`
  - `aggregateSuggestions(courses: ProcessedCourse[], week: number): CourseSuggestion[]`
  - `interface AgendaBuckets { thisWeek: ScheduleEvent[]; thisMonth: ScheduleEvent[] }`
  - `inCourseWindow(e: ScheduleEvent, week: number, fromWeek: number, toWeek: number): boolean`
  - `buildAgenda(events: ScheduleEvent[], week: number): AgendaBuckets`

- [ ] **Step 1: Append failing tests to `src/modules/schedule/signals/suggestionRules.test.ts`**

Add at the end of the file:
```ts
import { aggregateSuggestions } from './suggestionRules'

describe('aggregateSuggestions', () => {
  it('tags each course’s cards with that course', () => {
    // `course` fixture from this file has an escalation at week 3 for student 11.
    const a = { ...course, module: 'AAA', presentation: '2013J' }
    const b = { ...course, module: 'BBB', presentation: '2014J' }
    const result = aggregateSuggestions([a, b], 3)
    expect(result.length).toBeGreaterThan(0)
    expect(new Set(result.map((r) => r.module))).toEqual(new Set(['AAA', 'BBB']))
    for (const r of result) {
      expect(r.card).toHaveProperty('id')
      expect(typeof r.presentation).toBe('string')
    }
  })
  it('returns empty when no course has signals', () => {
    const calm = { ...course, students: [course.students[1]] } // student 12 is steady
    expect(aggregateSuggestions([calm], 3)).toEqual([])
  })
})
```
(Reuses the `course` fixture already defined earlier in this test file. If the existing file does not already `import { describe, it, expect }` at the top, it does — leave imports as they are; only add the `aggregateSuggestions` import and the new `describe`.)

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/modules/schedule/signals/suggestionRules.test.ts`
Expected: FAIL — `aggregateSuggestions` is not exported.

- [ ] **Step 3: Append `aggregateSuggestions` to `src/modules/schedule/signals/suggestionRules.ts`**

Add at the end of the file:
```ts
export interface CourseSuggestion {
  card: SuggestionCard
  module: string
  presentation: string
}

export function aggregateSuggestions(courses: ProcessedCourse[], week: number): CourseSuggestion[] {
  const out: CourseSuggestion[] = []
  for (const course of courses) {
    for (const card of computeSuggestions(course, week)) {
      out.push({ card, module: course.module, presentation: course.presentation })
    }
  }
  return out
}
```
(`ProcessedCourse` and `SuggestionCard` are already in scope in this file.)

- [ ] **Step 4: Run to verify the suggestion tests pass**

Run: `npx vitest run src/modules/schedule/signals/suggestionRules.test.ts`
Expected: PASS (existing + 2 new).

- [ ] **Step 5: Write the failing agenda test `src/modules/schedule/agenda.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { inCourseWindow, buildAgenda } from './agenda'
import { weekToDate } from '../../shared/scheduleAnchors'
import type { ScheduleEvent } from '../../types/domain'

function ev(presentation: string, week: number): ScheduleEvent {
  return { module: 'X', presentation, kind: 'lecture', title: `w${week}`, date: weekToDate(presentation, week), week, created_at: '' }
}

describe('inCourseWindow', () => {
  it('true when the event is in [week+from, week+to) of its own anchor', () => {
    expect(inCourseWindow(ev('2013J', 3), 3, 0, 1)).toBe(true)   // week-3 event, this-week window
    expect(inCourseWindow(ev('2013J', 5), 3, 0, 1)).toBe(false)  // week-5 event, not this week
    expect(inCourseWindow(ev('2013J', 5), 3, 1, 4)).toBe(true)   // week-5 event, next-4-weeks window
  })
  it('false for a presentation with no anchor', () => {
    const e: ScheduleEvent = { ...ev('2013J', 3), presentation: '9999X' }
    expect(inCourseWindow(e, 3, 0, 1)).toBe(false)
  })
})

describe('buildAgenda', () => {
  it('splits events into thisWeek and thisMonth by their own course anchor', () => {
    const events = [ev('2013J', 3), ev('2013J', 5), ev('2014J', 3)]
    const { thisWeek, thisMonth } = buildAgenda(events, 3)
    expect(thisWeek.map((e) => e.presentation).sort()).toEqual(['2013J', '2014J']) // both week-3 events, different years
    expect(thisMonth.map((e) => e.title)).toEqual(['w5'])
  })
  it('sorts each bucket ascending by date', () => {
    const events = [ev('2013J', 3), ev('2014J', 3)] // 2014 date is later
    expect(buildAgenda(events, 3).thisWeek.map((e) => e.presentation)).toEqual(['2013J', '2014J'])
  })
})
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx vitest run src/modules/schedule/agenda.test.ts`
Expected: FAIL — cannot resolve `./agenda`.

- [ ] **Step 7: Implement `src/modules/schedule/agenda.ts`**

```ts
import type { ScheduleEvent } from '../../types/domain'
import { PRESENTATION_ANCHORS, weekToDate } from '../../shared/scheduleAnchors'

export interface AgendaBuckets {
  thisWeek: ScheduleEvent[]
  thisMonth: ScheduleEvent[]
}

/** True if event e falls in [week+fromWeek, week+toWeek) of ITS OWN course anchor. */
export function inCourseWindow(e: ScheduleEvent, week: number, fromWeek: number, toWeek: number): boolean {
  if (!PRESENTATION_ANCHORS[e.presentation]) return false
  const t = new Date(e.date).getTime()
  const start = new Date(weekToDate(e.presentation, week + fromWeek)).getTime()
  const end = new Date(weekToDate(e.presentation, week + toWeek)).getTime()
  return t >= start && t < end
}

const byDate = (a: ScheduleEvent, b: ScheduleEvent) => new Date(a.date).getTime() - new Date(b.date).getTime()

export function buildAgenda(events: ScheduleEvent[], week: number): AgendaBuckets {
  return {
    thisWeek: events.filter((e) => inCourseWindow(e, week, 0, 1)).sort(byDate),
    thisMonth: events.filter((e) => inCourseWindow(e, week, 1, 4)).sort(byDate),
  }
}
```

- [ ] **Step 8: Run to verify agenda tests pass**

Run: `npx vitest run src/modules/schedule/agenda.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/modules/schedule/signals/suggestionRules.ts src/modules/schedule/signals/suggestionRules.test.ts src/modules/schedule/agenda.ts src/modules/schedule/agenda.test.ts
git commit -m "feat: add aggregateSuggestions and week-windowed agenda helpers"
```

---

## Task 3: Home — global suggestions + to-do

**Files:**
- Modify: `src/modules/home/components/SuggestionsPanel.tsx`
- Modify: `src/modules/home/components/TodoList.tsx`

**Interfaces:**
- Consumes: `dataService.getAllCourses()` (SP2); `scheduleService.listAll()` (Task 1); `aggregateSuggestions`/`CourseSuggestion` + `inCourseWindow` (Task 2); `weekToDate`, `eventBadge`, `contextStore`, `useChatStore`.

> UI — verified by `tsc` + `vite build`.

- [ ] **Step 1: Replace `src/modules/home/components/SuggestionsPanel.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { Box, Typography, Paper, Button, Stack, Alert, Chip } from '@mui/material'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { useChatStore } from '../../../shared/stores/chatStore'
import { aggregateSuggestions, type CourseSuggestion } from '../../schedule/signals/suggestionRules'
import { weekToDate } from '../../../shared/scheduleAnchors'

const keyOf = (s: CourseSuggestion) => `${s.module}/${s.presentation}/${s.card.id}`

export function SuggestionsPanel({ onTaskCreated }: { onTaskCreated: () => void }) {
  const { currentWeek, setModule, setPresentation, setChatPanelOpen } = useContextStore()
  const setPendingPrompt = useChatStore((s) => s.setPendingPrompt)
  const [items, setItems] = useState<CourseSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    container.dataService.getAllCourses()
      .then((courses) => { if (active) setItems(aggregateSuggestions(courses, currentWeek)) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Failed to compute suggestions') })
    return () => { active = false }
  }, [currentWeek])

  async function accept(s: CourseSuggestion) {
    setBusyKey(keyOf(s)); setError(null)
    try {
      await container.scheduleService.create({
        module: s.module, presentation: s.presentation,
        kind: 'task', title: s.card.defaultTask.title,
        date: weekToDate(s.presentation, currentWeek),
        week: currentWeek, source: 'suggestion', status: 'open',
        student_id: s.card.defaultTask.student_id,
      })
      setItems((cs) => cs.filter((c) => keyOf(c) !== keyOf(s)))
      onTaskCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task')
    } finally {
      setBusyKey(null)
    }
  }

  function askAgent(s: CourseSuggestion) {
    // Align global course context to this card's course so the agent reasons over it.
    setModule(s.module)
    setPresentation(s.presentation)
    setPendingPrompt(`${s.card.title}. ${s.card.detail} Review the affected student(s) in ${s.module} ${s.presentation} and propose interventions.`)
    setChatPanelOpen(true)
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Suggested actions</Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {items.length === 0 && <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Nothing needs attention this week.</Typography>}
      <Stack spacing={1}>
        {items.map((s) => (
          <Paper key={keyOf(s)} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ mr: 'auto' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>💡 {s.card.title}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.card.detail}</Typography>
              <Chip label={`${s.module} ${s.presentation}`} size="small" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />
            </Box>
            <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={() => askAgent(s)}>Ask agent</Button>
            <Button variant="contained" size="small" disabled={busyKey === keyOf(s)} onClick={() => accept(s)}>
              {busyKey === keyOf(s) ? 'Adding…' : 'Add to schedule'}
            </Button>
          </Paper>
        ))}
      </Stack>
    </Box>
  )
}
```

- [ ] **Step 2: Replace `src/modules/home/components/TodoList.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Box, Typography, Paper, Stack, Chip, Button, Alert } from '@mui/material'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { eventBadge } from '../../schedule/eventDisplay'
import { inCourseWindow } from '../../schedule/agenda'
import type { ScheduleEvent } from '../../../types/domain'

export function TodoList({ reloadKey }: { reloadKey: number }) {
  const { currentWeek } = useContextStore()
  const [items, setItems] = useState<ScheduleEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const all = await container.scheduleService.listAll()
      const visible = all.filter((e) =>
        (e.kind === 'task' && e.status === 'open') ||
        ((e.kind === 'class' || e.kind === 'lecture') && inCourseWindow(e, currentWeek, 0, 4)))
      visible.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      setItems(visible)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load to-do list')
    }
  }, [currentWeek])

  useEffect(() => { load() }, [load, reloadKey])

  async function markDone(e: ScheduleEvent) {
    if (!e._id) return
    setError(null)
    try {
      await container.scheduleService.update(e._id, { status: 'done' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task')
    }
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
                  {new Date(e.date).toLocaleDateString()} · {e.module} {e.presentation} · <Chip component="span" label={badge.label} size="small" sx={{ height: 16, fontSize: 9 }} />
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

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npx vite build`
Expected: tsc exit 0; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/modules/home/components/SuggestionsPanel.tsx src/modules/home/components/TodoList.tsx
git commit -m "feat: aggregate Home suggestions and to-do across all courses"
```

---

## Task 4: `ScheduleEventDialog` create-mode course picker

**Files:**
- Modify: `src/modules/schedule/components/ScheduleEventDialog.tsx`

**Interfaces:**
- Consumes: `dataService.getIndex()`.
- Produces: unchanged `onSave` payload; the dialog now sources `module`/`presentation` from a picker on create.

> UI — verified by `tsc` + `vite build`.

- [ ] **Step 1: Add imports to `src/modules/schedule/components/ScheduleEventDialog.tsx`**

Ensure these are imported (add whichever are missing):
```tsx
import { useQuery } from '@tanstack/react-query'
import { container } from '../../../di/container'
```
And make sure `Select`, `MenuItem`, `FormControl`, `InputLabel` are among the `@mui/material` imports (add any missing).

- [ ] **Step 2: Add course state + index query inside the component**

After the existing `useState` hooks (e.g. after `const [saving, setSaving] = useState(false)`), add:
```tsx
  const isCreate = !props.initial?._id
  const [mod, setMod] = useState('')
  const [pres, setPres] = useState('')
  const { data: index } = useQuery({ queryKey: ['oulad-index'], queryFn: () => container.dataService.getIndex(), retry: false })
  const moduleOptions = [...new Set(index?.courses.map((c) => c.module) ?? [])]
  const presentationOptions = index?.courses.filter((c) => c.module === mod).map((c) => c.presentation) ?? []
```

- [ ] **Step 3: Initialize course state in the existing open-effect**

Inside the `useEffect(() => { … }, [open, initial, defaultDate])` block, add (alongside the other `set…` calls):
```tsx
    const firstMod = props.initial?.module ?? index?.courses[0]?.module ?? ''
    const firstPres = props.initial?.presentation ?? index?.courses.find((c) => c.module === firstMod)?.presentation ?? ''
    setMod(firstMod)
    setPres(firstPres)
```
(Also add `index` to that effect's dependency array so the defaults populate once the index loads.)

- [ ] **Step 4: Use the picked course in the save payload**

In the object built inside `handleSave` (the `Omit<ScheduleEvent,'_id'|'created_at'>` literal), replace:
```tsx
        module: initial!.module!, presentation: initial!.presentation!,
```
with:
```tsx
        module: mod, presentation: pres,
```

- [ ] **Step 5: Render the course picker on create**

In the dialog's `<Stack>` of fields, immediately after the **Kind** `<TextField select …>` block, add:
```tsx
          {isCreate && (
            <>
              <FormControl size="small" fullWidth>
                <InputLabel>Module</InputLabel>
                <Select label="Module" value={mod} onChange={(e) => {
                  const m = e.target.value
                  setMod(m)
                  setPres(index?.courses.find((c) => c.module === m)?.presentation ?? '')
                }}>
                  {moduleOptions.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" fullWidth>
                <InputLabel>Presentation</InputLabel>
                <Select label="Presentation" value={pres} onChange={(e) => setPres(e.target.value)}>
                  {presentationOptions.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </Select>
              </FormControl>
            </>
          )}
```

- [ ] **Step 6: Type-check and build**

Run: `npx tsc --noEmit && npx vite build`
Expected: tsc exit 0; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/modules/schedule/components/ScheduleEventDialog.tsx
git commit -m "feat: add create-mode course picker to ScheduleEventDialog"
```

---

## Task 5: `WeeklyScheduleView` → week-driven agenda

**Files:**
- Modify: `src/modules/schedule/views/WeeklyScheduleView.tsx` (full rewrite)

**Interfaces:**
- Consumes: `scheduleService.listAll()` (Task 1); `buildAgenda`/`AgendaBuckets` (Task 2); `eventBadge`; `ScheduleEventDialog` (Task 4); `contextStore.currentWeek`.

> UI — verified by `tsc` + `vite build` + `vitest` + manual.

- [ ] **Step 1: Replace `src/modules/schedule/views/WeeklyScheduleView.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Typography, Paper, Button, Chip, Stack, Alert } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { eventBadge } from '../eventDisplay'
import { buildAgenda } from '../agenda'
import { ScheduleEventDialog } from '../components/ScheduleEventDialog'
import type { ScheduleEvent } from '../../../types/domain'

export function WeeklyScheduleView() {
  const { currentWeek } = useContextStore()
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleEvent | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setEvents(await container.scheduleService.listAll())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const agenda = useMemo(() => buildAgenda(events, currentWeek), [events, currentWeek])

  async function handleSave(data: Omit<ScheduleEvent, '_id' | 'created_at'>) {
    if (editing?._id) await container.scheduleService.update(editing._id, data)
    else await container.scheduleService.create(data)
    await load()
  }

  async function handleDelete() {
    if (!editing?._id) return
    try {
      await container.scheduleService.remove(editing._id)
      setDialogOpen(false); setEditing(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete event')
    }
  }

  async function toggleStatus(e: ScheduleEvent, status: 'done' | 'dismissed') {
    if (!e._id) return
    try {
      await container.scheduleService.update(e._id, { status })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event')
    }
  }

  function renderRow(e: ScheduleEvent) {
    const badge = eventBadge(e)
    const done = e.kind === 'task' && e.status !== 'open'
    return (
      <Paper key={e._id} variant="outlined"
        onClick={() => { setEditing(e); setDialogOpen(true) }}
        sx={{ p: 1.25, cursor: 'pointer', borderLeft: `3px solid ${badge.color}`, opacity: done ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ mr: 'auto' }}>
          <Typography sx={{ fontSize: 13 }}>{badge.emoji} {e.title}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {new Date(e.date).toLocaleDateString()} · {e.module} {e.presentation} · <Chip component="span" label={badge.label} size="small" sx={{ height: 16, fontSize: 9 }} />
          </Typography>
        </Box>
        {e.kind === 'task' && e.status === 'open' && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" onClick={(ev) => { ev.stopPropagation(); toggleStatus(e, 'done') }}>Done</Button>
            <Button size="small" onClick={(ev) => { ev.stopPropagation(); toggleStatus(e, 'dismissed') }}>Dismiss</Button>
          </Box>
        )}
      </Paper>
    )
  }

  function section(label: string, rows: ScheduleEvent[]) {
    return (
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>{label}</Typography>
        {rows.length === 0
          ? <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Nothing scheduled.</Typography>
          : <Stack spacing={1}>{rows.map(renderRow)}</Stack>}
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Weekly Schedule · Week {currentWeek}</Typography>
        <Button startIcon={<AddIcon />} variant="contained" sx={{ ml: 'auto' }}
          onClick={() => { setEditing(null); setDialogOpen(true) }}>
          Add event
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {section(`This week · week ${currentWeek}`, agenda.thisWeek)}
      {section('Upcoming · next 4 weeks', agenda.thisMonth)}

      <ScheduleEventDialog
        open={dialogOpen}
        initial={editing ?? undefined}
        defaultDate={editing?.date ?? new Date().toISOString()}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        onSave={handleSave}
        onDelete={editing?._id ? handleDelete : undefined}
      />
    </Box>
  )
}
```

- [ ] **Step 2: Type-check, build, and run the suite**

Run: `npx tsc --noEmit && npx vite build && npx vitest run`
Expected: tsc exit 0; build succeeds; all tests pass.

- [ ] **Step 3: Manual verification**

Run `npm run server` + `npm run dev`:
1. **Home** — Suggested actions show cards from multiple courses, each with a course chip; "Add to schedule" creates a task in that card's course; the To-do list spans courses.
2. **Weekly Schedule** — two sections, **This week · week N** and **Upcoming · next 4 weeks**, listing events across all courses (each course-chipped). Moving the global week slider changes which events appear.
3. A task row's **Done/Dismiss** works; clicking any row opens the dialog to **edit/delete**.
4. **Add event** → the dialog shows a **Module + Presentation** picker (create mode); saving persists the event and it appears in the agenda for the matching week.

- [ ] **Step 4: Commit**

```bash
git add src/modules/schedule/views/WeeklyScheduleView.tsx
git commit -m "feat: replace weekly grid with week-driven all-course agenda"
```

---

## Self-Review notes (for the implementer)

- **Spec §5 (listAll):** Task 1. **§6.1 (aggregateSuggestions):** Task 2. **§6.2 (SuggestionsPanel):** Task 3. **§6.3 (TodoList):** Task 3. **§7.1 (agenda helpers):** Task 2. **§7.2 (agenda view):** Task 5. **§7.3 (dialog course picker):** Task 4. **§8 (testing):** unit in Tasks 1–2, manual in Tasks 3–5.
- **Green builds:** each task compiles; `listAll` (Task 1) and the helpers (Task 2) land before their consumers (Tasks 3, 5); the dialog picker (Task 4) lands before the agenda's create flow (Task 5).
- **Cross-course correctness:** suggestion accept + askAgent use the card's own course; agenda windows use each event's own `presentation` anchor via `inCourseWindow`; the drawer/chat course-sync mirrors the SP2 fix.
- **Type consistency:** `CourseSuggestion` (Task 2) consumed by `SuggestionsPanel` (Task 3); `inCourseWindow`/`buildAgenda`/`AgendaBuckets` (Task 2) consumed by `TodoList` (Task 3) and `WeeklyScheduleView` (Task 5); `listAll` (Task 1) consumed by both.
