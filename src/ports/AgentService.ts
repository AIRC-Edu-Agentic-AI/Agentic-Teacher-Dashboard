import type { ChatMessage, AgentContext, AgentRunCallbacks } from '../types/domain'

export interface AgentService {
  /** Runs the agentic tool loop, emitting events and requesting approval for writes. */
  run(
    messages: ChatMessage[],
    context: AgentContext,
    cb: AgentRunCallbacks,
  ): Promise<void>

  /** @deprecated one-shot text stream; removed once ChatPanel migrates to run(). */
  stream(
    messages: ChatMessage[],
    context: AgentContext,
  ): AsyncIterable<string>
}
