import type { ChatMessage, AgentContext, AgentRunCallbacks } from '../types/domain'

export interface AgentService {
  /** Runs the agentic tool loop, emitting events and requesting approval for writes. */
  run(
    messages: ChatMessage[],
    context: AgentContext,
    cb: AgentRunCallbacks,
  ): Promise<void>
}
