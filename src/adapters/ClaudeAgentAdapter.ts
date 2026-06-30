import type { AgentService } from '../ports/AgentService'
import type { ChatMessage, AgentContext, AgentRunCallbacks } from '../types/domain'
import { container } from '../di/container'
import { TOOL_DEFINITIONS } from '../modules/chat/agent/tools'
import { runAgentLoop, type AnthropicResponse } from '../modules/chat/agent/runAgentLoop'

const MODEL = 'claude-sonnet-4-6'
const API_URL = '/api/claude/v1/messages'

function buildSystemPrompt(ctx: AgentContext): string {
  const studentBlock = ctx.activeStudent
    ? `Active student: #${ctx.activeStudent.id_student} | ` +
      `Tier ${ctx.activeStudent.tier_by_week[ctx.currentWeek - 1]} | ` +
      `Risk ${((ctx.activeStudent.risk_by_week[ctx.currentWeek - 1] ?? 0) * 100).toFixed(0)}% | ` +
      `IMD band: ${ctx.activeStudent.imd_band} | ` +
      `Prior attempts: ${ctx.activeStudent.num_of_prev_attempts}`
    : 'No student selected (discussing class-level data)'

  return `You are a pedagogical advisor integrated into an RTI/MTSS teacher dashboard for higher education.

CURRENT CONTEXT
- Module: ${ctx.module} | Presentation: ${ctx.presentation}
- Week: ${ctx.currentWeek} of ${ctx.numWeeks}
- ${studentBlock}
- Cohort tier distribution — Tier 1 (low risk): ${ctx.tierCounts.tier1} | Tier 2: ${ctx.tierCounts.tier2} | Tier 3 (high risk): ${ctx.tierCounts.tier3}

RISK MODEL (OULAD-derived heuristic)
Risk score = 1 − (0.45 × assessment performance + 0.35 × VLE engagement + 0.20 × submission rate)
Tier thresholds: Tier 1 < 0.33 · Tier 2 [0.33–0.66) · Tier 3 ≥ 0.66

GUIDANCE
When asked about interventions, use the RTI/MTSS framework:
- Tier 1: Universal support — quality teaching, peer learning, structured check-ins
- Tier 2: Targeted — small group tutoring, formative assessment, study skills coaching
- Tier 3: Intensive — 1-on-1 mentoring, withdrawal risk protocol, pastoral referral

Be specific, evidence-based, and actionable. Cite the student's actual risk score and engagement patterns when relevant. Keep responses concise and practical for a busy instructor.`
}

export class ClaudeAgentAdapter implements AgentService {
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
}
