# Nav Skeleton & Course-Context Relocation — Design Spec

**Date:** 2026-06-30
**Status:** Approved design, pending implementation plan
**Scope:** Sub-project 1 of 3 in the Information-Architecture Reorg. This is the navigation foundation. Sub-projects 2 (Student hub) and 3 (Global aggregation) build on it and get their own specs.

---

## 1. Context & purpose

The dashboard's pages are currently flat: a global top bar (`ContextBar`) forces a module/presentation selection onto **every** page, even ones that should be teacher-global, and the class-level views are split across two nav items (`Class overview` = `DashboardView`, `Class Management` = `ClassView`). This reorg establishes a clear hierarchy — **global pages** (no course needed) vs **course-scoped pages** (carry their own course selector) — and merges the two class views into one workspace.

This sub-project delivers the **navigation skeleton**: relocate the course selector off the global bar, regroup the nav, and merge the two class views into a tabbed `Class` workspace. It is independently shippable; Home/Weekly Schedule keep working on a default course until Sub-project 3 makes them aggregate.

## 2. Target information architecture (whole reorg, for context)

```
GLOBAL (no course selection)
├── Home               → (SP3) aggregates across all courses
├── Weekly Schedule    → (SP3) all schedule events, unfiltered
└── Student Management → (SP2) master roster + filters; row → student detail

COURSE-SCOPED (carries the course selector)
└── Class              → workspace, two tabs: Overview + Management   ← THIS SPEC

OVERLAY (SP2)
└── Student Detail     → shared cards; drawer (any page) + /student/:id full page
```

This spec implements only the **Class workspace** and the **selector relocation / nav regroup**. SP2 adds Student Management + the detail drawer; SP3 makes Home/Weekly Schedule aggregate.

## 3. Goals / Non-goals

**Goals**
- Remove the module/presentation selector from the global `ContextBar`; keep the week slider as a global "viewing week."
- Add a course selector to the new `Class` workspace header.
- Merge `DashboardView` (→ Overview tab) and `ClassView` (→ Management tab) into one course-scoped `ClassWorkspaceView` at `/class`.
- Regroup the sidebar nav registry to reflect the hierarchy.
- Keep Home and Weekly Schedule working unchanged on a default course (no behavior regression) — aggregation is SP3.

**Non-goals (deferred)**
- Student Management roster + filters, the student-detail drawer, shared `StudentDetailContent` extraction → **SP2**.
- Home / Weekly Schedule cross-course aggregation, `getAllCourses()` / `listAll()` service additions → **SP3**.
- Any data-model or server change. This is a UI/navigation reorg only.

## 4. Architecture overview

Follows existing patterns: `Shell` renders the sidebar (from `moduleRegistry`), the top bar, the routed content, and the `ChatPanel`. `contextStore` (Zustand) holds `selectedModule`, `selectedPresentation`, `currentWeek`, `numWeeks`, `activeStudent`. Routing is React Router in `App.tsx`.

The only state-model change is conceptual: `selectedModule`/`selectedPresentation` stop being a *global, always-visible* selection and become the **course context owned by the Class workspace** (still stored in `contextStore`, still defaulted to the first course so Home/Weekly Schedule keep working until SP3). The week slider stays global.

## 5. ContextBar → global top bar (slimmed)

`src/shared/components/ContextBar.tsx` currently renders Module + Presentation + Week. Change it to render **only the week slider** (and keep the auto-default-course effect, since Home/Weekly Schedule still read a default course until SP3).

- Remove the Module `<Select>` and Presentation `<Select>` from the rendered output.
- Keep the `useQuery(['oulad-index'])` + the effect that auto-selects the first course into `contextStore` on load (so a default course exists), and the effect that syncs `numWeeks` from the loaded course.
- Keep the week `<Slider>` bound to `currentWeek` / `setCurrentWeek`, bounded by `numWeeks`.
- Rename nothing in `contextStore`; `setModule`/`setPresentation` remain (now driven by the Class workspace selector, §6).

Result: the global bar shows just "Viewing week: N".

## 6. Class workspace (`/class`)

New view `src/modules/class/views/ClassWorkspaceView.tsx` replacing the routes for both `/overview` and `/class`:

- **Header:** a **course selector** (Module + Presentation `<Select>`s, the markup moved out of `ContextBar`) bound to `contextStore.setModule`/`setPresentation`, plus an MUI `<Tabs>` with two tabs: **Overview** and **Management**.
- **Overview tab:** renders the existing `DashboardView`'s body content (risk tiles, tier distribution, attendance, course schedule). Extract `DashboardView`'s inner content into a `ClassOverviewTab` component (or render `<DashboardView />` directly inside the tab if it has no page-level chrome that conflicts). Prefer extracting the body so the tab owns layout.
- **Management tab:** renders the existing `ClassView`'s body (`AttendanceDashboard` + `NotificationManager`). Extract into a `ClassManagementTab` component.
- Selecting a course updates `contextStore`; both tabs read course from `contextStore` exactly as `DashboardView`/`ClassView` do today (no per-tab fetching changes).
- The active tab is local component state (default Overview). No new route per tab.

`DashboardView` and `ClassView` are reduced to thin wrappers or removed; their child components (`RiskTilesRow`, `TierDistributionChart`, `AttendanceDashboard`, `NotificationManager`, etc.) are reused unchanged.

## 7. Routing & registry

`src/App.tsx`:
- `/class` → `<ClassWorkspaceView />`.
- `/overview` → `<Navigate to="/class" replace />` (old links/redirects don't 404).
- `/` (Home), `/schedule`, `/student/:id`, `/student` unchanged this sub-project.

`src/modules/registry.tsx` — regroup into the target order; the two class items collapse into one:
```
Home            → /
Weekly Schedule → /schedule
Student detail  → /student        (unchanged; SP2 replaces with Student Management)
Class           → /class          (merged; ClassIcon)
```
Remove the separate `dashboard` ("Class overview", `/overview`) entry. Keep `student` until SP2.

## 8. Error handling

No new failure modes. The Class workspace shows the existing "select a module/presentation" empty states from the child components when no course is set (the auto-default makes this rare). The week slider and course selector are pure `contextStore` writes.

## 9. Testing

This is a UI/navigation refactor with no logic extraction, so it is verified by type-check, build, and manual navigation — consistent with how Spec 1/2 verified their UI tasks.

- `npx tsc --noEmit` → clean.
- `npx vite build` → succeeds.
- `npx vitest run` → existing suite still passes (no tests changed; nothing they cover is removed).
- **Manual acceptance:** global top bar shows only the week slider; the sidebar shows Home / Weekly Schedule / Student detail / Class; `/class` shows a course selector + Overview/Management tabs rendering the former DashboardView and ClassView content; switching course updates both tabs; visiting `/overview` redirects to `/class`; Home and Weekly Schedule still render on the default course exactly as before.

## 10. Out of scope → SP2 / SP3

- **SP2 — Student hub:** `StudentManagementView` (global roster + filters), extract the student-detail card grid into a shared `StudentDetailContent`, add a `StudentDetailDrawer` + `contextStore` drawer state, reuse on `/student/:id`, and replace the `Student detail` nav entry with `Student Management`.
- **SP3 — Global aggregation:** make Home aggregate suggestions/at-risk/to-dos across all courses and Weekly Schedule list all events; add `dataService.getAllCourses()` and `scheduleService.listAll()`; the global week slider becomes the only shared course-independent control.
