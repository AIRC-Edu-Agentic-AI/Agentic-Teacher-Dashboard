# Nav Skeleton & Course-Context Relocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the module/presentation selector off the global top bar into a course-scoped `Class` workspace that merges the former Class Overview and Class Management into two tabs, leaving the global bar with just a "viewing week" slider.

**Architecture:** Pure UI/navigation refactor. Extract the two course `<Select>`s from `ContextBar` into a reusable `CourseSelector`; slim `ContextBar` to the week slider; create `ClassWorkspaceView` (header `CourseSelector` + MUI `<Tabs>`) that renders the existing `DashboardView` (Overview) and `ClassView` (Management) unchanged; repoint routing + nav registry. No data-model, server, or component-logic changes.

**Tech Stack:** TypeScript (strict), React 18, MUI v5, Zustand (`contextStore`), React Router, Vite 5, Vitest.

## Global Constraints

- TypeScript strict; no `any`.
- UI/navigation only — do NOT change `contextStore` field names, data services, server routes, or the child components (`RiskTilesRow`, `AttendanceDashboard`, `NotificationManager`, etc.).
- `DashboardView` and `ClassView` are rendered **as-is** inside tabs (the spec explicitly permits rendering them directly rather than extracting their bodies — chosen to avoid a risky refactor of DashboardView's role-based course logic).
- The course selector reads/writes `contextStore.selectedModule`/`selectedPresentation`; the week slider reads/writes `currentWeek`/`numWeeks`. The auto-default-first-course effect stays in `ContextBar` so a default course always exists (Home/Weekly Schedule still work pre-SP3).
- MUI v5 components only. Commit after each task with the message in its final step.
- Verification is `npx tsc --noEmit` (exit 0) + `npx vite build` (success; chunk-size warning is fine) + `npx vitest run` (existing suite still passes). No new unit tests — this is a no-logic UI refactor.

---

## File Structure

**Create:**
- `src/shared/components/CourseSelector.tsx` — Module + Presentation selects bound to `contextStore` (extracted from `ContextBar`).
- `src/modules/class/views/ClassWorkspaceView.tsx` — course-scoped workspace: `CourseSelector` header + Overview/Management tabs.

**Modify:**
- `src/shared/components/ContextBar.tsx` — remove the two selects; keep the week slider + the auto-default/index/course-query effects.
- `src/App.tsx` — `/class` → `ClassWorkspaceView`; `/overview` → redirect to `/class`; drop now-unused `DashboardView`/`ClassView` direct imports.
- `src/modules/registry.tsx` — regroup nav; collapse the two class items into one `Class` entry.

---

## Task 1: Relocate the course selector (CourseSelector + slim ContextBar)

**Files:**
- Create: `src/shared/components/CourseSelector.tsx`
- Modify: `src/shared/components/ContextBar.tsx`

**Interfaces:**
- Consumes: `container.dataService.getIndex()`; `contextStore` (`selectedModule`, `selectedPresentation`, `setModule`, `setPresentation`, `currentWeek`, `setCurrentWeek`, `setNumWeeks`).
- Produces: `CourseSelector` (default-free named export) — a self-contained Module+Presentation picker writing to `contextStore`.

> No unit test — pure presentational refactor. Verified by `tsc` + `vite build`. After this task there is temporarily no visible course picker (the auto-default effect still sets a course); Task 2 mounts `CourseSelector` in the workspace.

- [ ] **Step 1: Create `src/shared/components/CourseSelector.tsx`**

```tsx
import { Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { tokens } from '../../theme'
import { container } from '../../di/container'
import { useContextStore } from '../stores/contextStore'

export function CourseSelector() {
  const { selectedModule, selectedPresentation, setModule, setPresentation } = useContextStore()

  const { data: index } = useQuery({
    queryKey: ['oulad-index'],
    queryFn: () => container.dataService.getIndex(),
    retry: false,
  })

  const moduleOptions = [...new Set(index?.courses.map((c) => c.module) ?? [])]
  const presentationOptions = index?.courses
    .filter((c) => c.module === selectedModule)
    .map((c) => c.presentation) ?? []

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <FormControl size="small" sx={{ minWidth: 110 }}>
        <InputLabel sx={{ fontSize: 12 }}>Module</InputLabel>
        <Select
          value={selectedModule}
          label="Module"
          onChange={(e) => {
            const mod = e.target.value
            const firstPres = index?.courses.find((c) => c.module === mod)?.presentation ?? ''
            setModule(mod)
            setPresentation(firstPres)
          }}
          sx={{ fontSize: 12, fontFamily: tokens.font.mono }}
        >
          {moduleOptions.map((m) => (
            <MenuItem key={m} value={m} sx={{ fontSize: 12, fontFamily: tokens.font.mono }}>{m}</MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 110 }}>
        <InputLabel sx={{ fontSize: 12 }}>Presentation</InputLabel>
        <Select
          value={selectedPresentation}
          label="Presentation"
          onChange={(e) => setPresentation(e.target.value)}
          sx={{ fontSize: 12, fontFamily: tokens.font.mono }}
        >
          {presentationOptions.map((p) => (
            <MenuItem key={p} value={p} sx={{ fontSize: 12, fontFamily: tokens.font.mono }}>{p}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  )
}
```

- [ ] **Step 2: Replace `src/shared/components/ContextBar.tsx` with the week-only version**

```tsx
import { useEffect } from 'react'
import { Box, Slider, Typography } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { tokens } from '../../theme'
import { container } from '../../di/container'
import { useContextStore } from '../stores/contextStore'

export function ContextBar() {
  const { selectedModule, selectedPresentation, currentWeek, setModule, setPresentation, setCurrentWeek, setNumWeeks } = useContextStore()

  const { data: index } = useQuery({
    queryKey: ['oulad-index'],
    queryFn: () => container.dataService.getIndex(),
    retry: false,
  })

  const { data: course } = useQuery({
    queryKey: ['course', selectedModule, selectedPresentation],
    queryFn: () => container.dataService.getCourse(selectedModule, selectedPresentation),
    enabled: !!selectedModule && !!selectedPresentation,
  })

  useEffect(() => {
    if (index && !selectedModule && index.courses.length > 0) {
      const first = index.courses[0]
      setModule(first.module)
      setPresentation(first.presentation)
      setNumWeeks(first.num_weeks)
    }
  }, [index, selectedModule, setModule, setPresentation, setNumWeeks])

  useEffect(() => {
    if (course) setNumWeeks(course.num_weeks)
  }, [course, setNumWeeks])

  const numWeeks = course?.num_weeks ?? 39

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
      px: 3, py: 1, bgcolor: tokens.surface.paper, borderBottom: `1px solid ${tokens.border.default}`,
      minHeight: 52, flexShrink: 0,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 220, flex: 1, maxWidth: 360 }}>
        <Typography sx={{ fontSize: 11, color: tokens.text.secondary, fontFamily: tokens.font.mono, whiteSpace: 'nowrap' }}>
          Viewing week
        </Typography>
        <Slider
          min={1} max={numWeeks} value={currentWeek}
          onChange={(_, v) => setCurrentWeek(v as number)}
          size="small"
          sx={{ color: tokens.brand.primaryLight }}
        />
        <Typography sx={{ fontSize: 12, fontFamily: tokens.font.mono, color: tokens.text.primary, minWidth: 36 }}>
          {currentWeek}/{numWeeks}
        </Typography>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 3: Type-check and build**

Run: `npx tsc --noEmit && npx vite build`
Expected: tsc exit 0 (no unused-import errors — `noUnusedLocals` is off, but the file above leaves nothing unused anyway); build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/CourseSelector.tsx src/shared/components/ContextBar.tsx
git commit -m "feat: extract CourseSelector; slim global ContextBar to week slider only"
```

---

## Task 2: Class workspace (merge Overview + Management) + routing & registry

**Files:**
- Create: `src/modules/class/views/ClassWorkspaceView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/modules/registry.tsx`

**Interfaces:**
- Consumes: `CourseSelector` (Task 1); `DashboardView` (`src/modules/dashboard/views/DashboardView`); `ClassView` (`src/modules/class/views/ClassView`).
- Produces: `ClassWorkspaceView` (named export) routed at `/class`.

> No unit test — UI/navigation refactor. Verified by `tsc` + `vite build` + existing `vitest` suite + manual nav.

- [ ] **Step 1: Create `src/modules/class/views/ClassWorkspaceView.tsx`**

```tsx
import { useState } from 'react'
import { Box, Tabs, Tab } from '@mui/material'
import { tokens } from '../../../theme'
import { CourseSelector } from '../../../shared/components/CourseSelector'
import { DashboardView } from '../../dashboard/views/DashboardView'
import { ClassView } from './ClassView'

export function ClassWorkspaceView() {
  const [tab, setTab] = useState(0)

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        px: 3, py: 1.5, bgcolor: tokens.surface.paper,
        borderBottom: `1px solid ${tokens.border.default}`, flexShrink: 0,
      }}>
        <CourseSelector />
        <Tabs value={tab} onChange={(_, v) => setTab(v as number)} sx={{ ml: 1, minHeight: 36 }}>
          <Tab label="Overview" sx={{ fontSize: 13, textTransform: 'none', minHeight: 36 }} />
          <Tab label="Management" sx={{ fontSize: 13, textTransform: 'none', minHeight: 36 }} />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {tab === 0 ? <DashboardView /> : <ClassView />}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Update routes in `src/App.tsx`**

Add the import (near the other view imports):
```tsx
import { ClassWorkspaceView } from './modules/class/views/ClassWorkspaceView'
```
Change the `/overview` and `/class` routes to:
```tsx
        <Route path="/overview" element={<Navigate to="/class" replace />} />
        <Route path="/class" element={<ClassWorkspaceView />} />
```
Remove the now-unused direct imports of `DashboardView` and `ClassView` from `App.tsx` (they are imported by `ClassWorkspaceView` instead). Leave `StudentDetailView`, `HomeView`, `WeeklyScheduleView`, and the `Navigate` import in place. The `/student/:id`, `/student`, `/`, `/schedule`, and `*` routes are unchanged.

- [ ] **Step 3: Regroup the nav in `src/modules/registry.tsx`**

Replace the `moduleRegistry` array so the two class items collapse into one `Class` entry, in the target order. Remove the `DashboardIcon` import (no longer used):
```tsx
import React from 'react'
import HomeIcon from '@mui/icons-material/HomeRounded'
import PersonIcon from '@mui/icons-material/PersonRounded'
import ClassIcon from '@mui/icons-material/ClassRounded'
import CalendarIcon from '@mui/icons-material/CalendarMonthRounded'

export interface ModuleConfig {
  id: string
  label: string
  path: string
  icon: React.ReactNode
}

export const moduleRegistry: ModuleConfig[] = [
  { id: 'home', label: 'Home', path: '/', icon: <HomeIcon fontSize="small" /> },
  { id: 'schedule', label: 'Weekly Schedule', path: '/schedule', icon: <CalendarIcon fontSize="small" /> },
  { id: 'student', label: 'Student detail', path: '/student', icon: <PersonIcon fontSize="small" /> },
  { id: 'class', label: 'Class', path: '/class', icon: <ClassIcon fontSize="small" /> },
]
```

- [ ] **Step 4: Type-check, build, and run the test suite**

Run: `npx tsc --noEmit && npx vite build && npx vitest run`
Expected: tsc exit 0; build succeeds; all existing tests pass.

- [ ] **Step 5: Manual verification**

Run `npm run server` + `npm run dev`. Confirm:
1. The global top bar shows only "Viewing week" + slider (no Module/Presentation selects).
2. The sidebar shows: Home, Weekly Schedule, Student detail, Class (no separate "Class overview").
3. `/class` shows a Module + Presentation selector and Overview / Management tabs; Overview renders the analytics (risk tiles, tables, charts), Management renders attendance + notifications.
4. Changing the course in the workspace selector updates both tabs.
5. Visiting `/overview` redirects to `/class`.
6. Home and Weekly Schedule still render on the default course (no regression).

- [ ] **Step 6: Commit**

```bash
git add src/modules/class/views/ClassWorkspaceView.tsx src/App.tsx src/modules/registry.tsx
git commit -m "feat: merge Class Overview + Management into tabbed Class workspace; regroup nav"
```

---

## Self-Review notes (for the implementer)

- **Spec §5 (slim ContextBar):** Task 1. **§6 (Class workspace + selector):** Task 2 Step 1. **§7 (routing + registry):** Task 2 Steps 2–3. **§9 (verification):** Task 2 Steps 4–5.
- **Green builds:** after Task 1 the app still runs on the auto-defaulted course (selector temporarily absent); Task 2 restores a visible selector in the workspace. No task leaves the build broken.
- **No behavior change to Home/Weekly Schedule** — they keep reading `contextStore`'s default course; cross-course aggregation is SP3.
- **Type consistency:** `CourseSelector` (Task 1) is consumed by `ClassWorkspaceView` (Task 2) by exact named import; `contextStore` field names are untouched.
- The week slider label changed from "Week" to "Viewing week" to signal its now-global role (cosmetic, per spec §5).
