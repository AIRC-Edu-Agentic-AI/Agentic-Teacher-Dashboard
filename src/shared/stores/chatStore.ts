import { create } from 'zustand'
import type { ChatMessage } from '../../types/domain'

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  pendingPrompt: string | null

  addMessage: (msg: ChatMessage) => void
  appendToLast: (text: string) => void
  setStreaming: (v: boolean) => void
  clearMessages: () => void
  setPendingPrompt: (p: string | null) => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  pendingPrompt: null,

  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages, msg] })),

  appendToLast: (text) =>
    set((s) => {
      if (s.messages.length === 0) return s
      const updated = [...s.messages]
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        content: updated[updated.length - 1].content + text,
      }
      return { messages: updated }
    }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  clearMessages: () => set({ messages: [] }),

  setPendingPrompt: (pendingPrompt) => set({ pendingPrompt }),
}))
