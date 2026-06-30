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
