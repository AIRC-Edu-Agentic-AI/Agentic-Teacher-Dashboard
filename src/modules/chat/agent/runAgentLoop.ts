import type { AgentContext, AgentRunCallbacks, ProposedActionTool } from '../../../types/domain'
import type { ToolDefinition } from './tools'
import { WRITE_TOOLS } from './tools'
import { executeTool, type AgentDeps } from './executeTool'

export interface AnthropicBlock {
  type: string
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

export interface AnthropicResponse {
  stop_reason: string
  content: AnthropicBlock[]
}

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: unknown
}

export interface RunAgentLoopParams {
  system: string
  messages: AnthropicMessage[]
  tools: ToolDefinition[]
  context: AgentContext
  deps: AgentDeps
  callbacks: AgentRunCallbacks
  postToAnthropic: (body: object) => Promise<AnthropicResponse>
}

const MODEL = 'claude-sonnet-4-6'
const MAX_TURNS = 8

function previewFor(name: string, input: Record<string, unknown>): string {
  if (name === 'send_notification') return `Send "${input.title}" to student #${input.student_id}`
  if (name === 'create_task') return `Create task "${input.title}" for student #${input.student_id}`
  return `${name}`
}

export async function runAgentLoop(p: RunAgentLoopParams): Promise<void> {
  const messages: AnthropicMessage[] = [...p.messages]

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = await p.postToAnthropic({
        model: MODEL,
        max_tokens: 1024,
        system: p.system,
        tools: p.tools,
        messages,
      })

      for (const block of res.content) {
        if (block.type === 'text' && block.text) p.callbacks.onEvent({ type: 'text', text: block.text })
      }

      if (res.stop_reason !== 'tool_use') {
        p.callbacks.onEvent({ type: 'done' })
        return
      }

      const toolUses = res.content.filter((b) => b.type === 'tool_use')
      messages.push({ role: 'assistant', content: res.content })

      const toolResults: object[] = []
      for (const tu of toolUses) {
        const name = tu.name ?? ''
        const input = tu.input ?? {}
        p.callbacks.onEvent({ type: 'tool_start', tool: name, input })

        if (WRITE_TOOLS.has(name)) {
          const decision = await p.callbacks.requestApproval({
            tool: name as ProposedActionTool,
            input,
            preview: previewFor(name, input),
          })
          if (decision.action === 'reject') {
            toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: 'User rejected this action.', is_error: true })
            p.callbacks.onEvent({ type: 'tool_result', tool: name, ok: false, summary: 'Rejected by teacher' })
            continue
          }
          const finalInput = decision.input ?? input
          const r = await executeTool(name, finalInput, p.context, p.deps)
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: r.content, is_error: !r.ok })
          p.callbacks.onEvent({ type: 'tool_result', tool: name, ok: r.ok, summary: r.content })
        } else {
          const r = await executeTool(name, input, p.context, p.deps)
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: r.content, is_error: !r.ok })
          p.callbacks.onEvent({ type: 'tool_result', tool: name, ok: r.ok, summary: r.content })
        }
      }

      messages.push({ role: 'user', content: toolResults })
    }
    p.callbacks.onEvent({ type: 'done' })
  } catch (e) {
    p.callbacks.onEvent({ type: 'error', message: e instanceof Error ? e.message : 'Agent run failed' })
  }
}
