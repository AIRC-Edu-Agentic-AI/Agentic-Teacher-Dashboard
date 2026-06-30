# Agentic Spine — Design Spec

**Date:** 2026-06-30
**Status:** Approved design, pending implementation plan
**Scope:** Spec 2 of 2. The "brain." Builds on **Spec 1 — Schedule & Tasks Foundation** (branch `docs/schedule-tasks-spec`), reusing its `ScheduleService.create` seam.

---

## 1. Context & purpose

The teacher dashboard demonstrates **agentic** capability over the OULAD learning-analytics dataset. Spec 1 built the "arms and legs" (schedule, tasks, home page, suggestion signals) with no agent. This spec adds the brain: it upgrades the existing chat agent from a one-shot text streamer into a **tool-using agentic loop** with human-in-the-loop approval, so the teacher can ask *"Who's at risk this week and what should I do?"* and the agent reads the data, diagnoses a student, and proposes interventions it can execute on approval.

The demo loop is **Triage → Diagnose → Intervene**: read the at-risk watchlist → read a student's detail → propose a notification and/or an intervention task → on approval, send the notification and create the task (which surfaces on Spec 1's Weekly Schedule and to-do list).

## 2. Current state

- `src/adapters/ClaudeAgentAdapter.ts` implements `AgentService.stream(messages, context): AsyncIterable<string>` — a one-shot, chat-only call that POSTs to `/api/claude/v1/messages` (Vite dev proxy injects the API key) with `stream: true` and yields text deltas. No tools.
- `src/modules/chat/components/ChatPanel.tsx` consumes `container.agentService.stream(...)` and appends chunks to the assistant message.
- Model is `claude-sonnet-4-20250514` — **deprecated (retires 2026-06-15)**.
- Spec 1 provides `container.scheduleService.create({kind:'task', ...})`, `container.dataService.getCourse/getStudent`, `computeSuggestions`, and the `contextStore` (`selectedModule`, `selectedPresentation`, `currentWeek`, `activeStudent`).

## 3. Goals / Non-goals

**Goals**
- Upgrade `ClaudeAgentAdapter` to a manual agentic tool loop (read tools auto-run; write tools require approval).
- Four tools: `list_at_risk_students`, `get_student_detail` (read); `send_notification`, `create_task` (write).
- Approve-each-write UX: an inline proposed-action card (Approve / Edit / Reject) in the chat stream.
- A new student-targeted notification surface (server endpoint + collection + client port/adapter).
- Wire home suggestion cards to seed the chat and run the loop.
- Update the model to `claude-sonnet-4-6`.

**Non-goals (deferred)**
- Streaming the final assistant text during the tool loop (loop is non-streaming for reliability).
- Concept-graph tools, assessment-chase loop, autonomy modes (full auto / suggest-only).
- A production Anthropic proxy (the `/api/claude` Vite proxy is dev-only — documented carry-over from Spec 1).

## 4. Architecture overview

The agent loop stays **client-side**, calling Anthropic through the existing `/api/claude` Vite proxy. The loop is **non-streaming**: each turn is one complete `POST /api/claude/v1/messages` whose response carries a `stop_reason`.

```
ChatPanel ──run(messages, ctx, callbacks)──▶ ClaudeAgentAdapter (tool loop)
   ▲  onEvent / requestApproval                     │
   │                                                ├─ read tools  → container.dataService (local JSON)
   └─ renders text + tool chips + approval cards     └─ write tools → container.scheduleService.create
                                                                    → container.notificationService.send → /api/student-notifications
```

Per turn: send `messages` + `tools` + system prompt → parse `response.content` → for each `tool_use` block, execute (read) or request approval then execute (write) → append the full assistant `content` and a single user message of `tool_result` blocks → repeat until `stop_reason === 'end_turn'`.

## 5. The `AgentService` port change

Replace the string-stream method with a callback-driven run so the UI can render tool activity and intercept writes for approval.

```ts
// src/types/domain.ts — new agent event/loop types
export type ProposedActionTool = 'send_notification' | 'create_task'

export interface ProposedAction {
  tool: ProposedActionTool
  input: Record<string, unknown>   // the tool_use input, editable before approval
  preview: string                  // human-readable summary for the card
}

export type ApprovalDecision =
  | { action: 'approve'; input?: Record<string, unknown> }  // optional edited input
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
```

```ts
// src/ports/AgentService.ts
export interface AgentService {
  run(messages: ChatMessage[], context: AgentContext, cb: AgentRunCallbacks): Promise<void>
}
```

The old `stream()` method is removed; `ChatPanel` is updated to drive `run(...)`.

## 6. Anthropic tool-use mechanics (reference)

- Request adds `tools: [{ name, description, input_schema }]`. Drop `stream: true`; the loop is non-streaming.
- Response `stop_reason: 'tool_use'` → `content` contains `tool_use` blocks `{ type:'tool_use', id, name, input }`.
- Reply with a **user** message whose `content` is one or more `tool_result` blocks `{ type:'tool_result', tool_use_id, content, is_error? }` — all results for a turn in a single user message.
- Always append the full assistant `response.content` (including `tool_use` blocks) before the `tool_result` user message.
- Loop until `stop_reason: 'end_turn'`; surface text blocks via `onEvent`.
- Model `claude-sonnet-4-6` uses adaptive thinking — no `budget_tokens`, no `temperature`/`top_p`/`top_k` (those 400). The current request sends none of those, so only the model id and the `tools`/non-streaming changes are needed.

## 7. The four tools

Definitions live in `src/modules/chat/agent/tools.ts` (schemas) and execution in `src/modules/chat/agent/executeTool.ts`.

| Tool | Type | Input schema | Execution |
|---|---|---|---|
| `list_at_risk_students` | read | `{ limit?: number }` | From the loaded course at `currentWeek`: rank students by tier then risk; return `[{ id_student, tier, risk, decayed_engagement }]` (cap `limit`, default 10). |
| `get_student_detail` | read | `{ student_id: number }` | `dataService.getStudent` → `{ tier_now, tier_prev, risk_now, missing_assessments[], lstm_forecast, engagement_trend }`. |
| `send_notification` | **write** | `{ student_id, title, body, type }` | `notificationService.send({ student_id, module, presentation, title, body, type })`. |
| `create_task` | **write** | `{ student_id, title, due_week?, note? }` | `scheduleService.create({ kind:'task', source:'intervention', student_id, title, date: weekToDate(presentation, due_week ?? currentWeek), week: due_week ?? currentWeek, status:'open' })`. |

Read tools execute immediately; write tools call `requestApproval` first and only execute on `{ action:'approve' }` (using edited `input` if present). On reject, the loop appends a `tool_result` with `is_error: true` and content `"User rejected this action."` so the agent can adapt.

`module`/`presentation`/`currentWeek` come from `AgentContext` (already passed to the agent), not from tool input.

## 8. New notification surface

Mirrors Spec 1's `ScheduleService` pattern exactly.

- **Domain** (`src/types/domain.ts`):
  ```ts
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
- **Server** (`server/index.ts`): `POST /api/student-notifications` (validates `student_id, module, presentation, title, body, type`; rejects missing with 400) and `GET /api/student-notifications?module=&presentation=&student_id=` (filtered, newest-first). Collection: `student_notifications`.
- **Client**: `src/ports/NotificationService.ts` (`send(n): Promise<StudentNotification>`, `list(...): Promise<StudentNotification[]>`) + `src/adapters/ApiNotificationAdapter.ts` (throws on non-2xx, same `handle<T>` pattern as `ApiScheduleAdapter`) + register `notificationService` in `src/di/container.ts`.

## 9. UI — approval cards + home wiring

### 9.1 ChatPanel (rework)
- Drives `container.agentService.run(messages, ctx, { onEvent, requestApproval })`.
- Renders, in order, from `onEvent`: assistant text bubbles, small **tool-activity chips** (`🔎 reading watchlist…`, `✓ read student #12`), and for each write, an inline **ProposedActionCard**.
- `requestApproval` returns a Promise the card resolves: **Approve** (`{action:'approve'}`), **Edit** (approve with modified `input` — editable title/body/note fields), **Reject** (`{action:'reject'}`). The loop blocks on this Promise.
- New component `src/modules/chat/components/ProposedActionCard.tsx`.

### 9.2 Home suggestion cards (rework)
- `SuggestionsPanel` card primary action becomes **"Ask agent"**: open the chat panel (`contextStore.setChatPanelOpen(true)`), seed a user message derived from the card (e.g. *"3 students escalated to a higher risk tier this week — review them and propose interventions."*), and run the loop.
- The Spec 1 direct **"Add to schedule"** (create task without the agent) remains as a secondary action, so the manual path still works.

## 10. Testing

- **Tool dispatch (unit):** a `runToolLoop` helper fed a scripted sequence of fake Anthropic responses (tool_use → tool_use → end_turn) over a mocked `fetch`; assert read tools auto-execute, write tools call `requestApproval`, a reject yields an `is_error` tool_result, and the loop terminates on `end_turn`.
- **Read-tool data functions (unit):** `list_at_risk_students` ranking and `get_student_detail` shaping over local JSON fixtures (deterministic).
- **Notification adapter (unit):** `ApiNotificationAdapter` against a mocked fetch — asserts non-2xx throws (silent-failure guard), mirroring Spec 1's adapter test.
- **Server (unit):** `validateStudentNotification` rejects missing required fields.
- **Manual acceptance:** start `npm run server` + `npm run dev`; from Home click "Ask agent" on a suggestion → the agent reads the watchlist and a student, proposes a notification → Approve sends it (visible via `GET /api/student-notifications`) → proposes a task → Approve creates it (visible on the Weekly Schedule and to-do list).

## 11. Out of scope / carry-over notes

- The `/api/claude` proxy is **dev-only** (Vite config). Production would route Anthropic through the Express server — same carry-over noted in Spec 1, still deferred.
- Streaming the final assistant text during the tool loop is deferred; the loop is non-streaming for reliability. A follow-up can stream the terminal `end_turn` message.
- No autonomy modes — every write always requires approval, by design.
