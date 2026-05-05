import { useRef, useEffect, useState } from 'react'
import {
  Box, Typography, TextField, IconButton, Chip, Toolbar,
  CircularProgress, Alert, Paper,
} from '@mui/material'
import SendIcon from '@mui/icons-material/SendRounded'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlineRounded'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { useChatStore } from '../../../shared/stores/chatStore'
import { MessageBubble } from '../components/MessageBubble'
import type { AgentContext, ChatMessage, Tier } from '../../../types/domain'
import { useQuery } from '@tanstack/react-query'

import type { StudentProfile } from '../../../types/domain'

function buildContext(
  module: string, presentation: string, currentWeek: number, numWeeks: number,
  activeStudent: StudentProfile | null,
  students: { risk_by_week: number[]; tier_by_week: (1|2|3)[] }[]
): AgentContext {
  const weekIdx = Math.max(0, currentWeek - 1)
  const tierCounts = { tier1: 0, tier2: 0, tier3: 0 }
  for (const s of students) {
    const tier = s.tier_by_week[weekIdx] ?? 1
    if (tier === 1) tierCounts.tier1++
    else if (tier === 2) tierCounts.tier2++
    else tierCounts.tier3++
  }
  return { module, presentation, currentWeek, numWeeks, activeStudent, tierCounts }
}

const SUGGESTED_PROMPTS = [
  'Which Tier 3 students need immediate intervention this week?',
  'What targeted interventions do you recommend for Tier 2 students?',
  'Summarise engagement patterns for the current week.',
  'Which students show improving trajectories?',
]

export function ChatView() {
  const { selectedModule, selectedPresentation, currentWeek, numWeeks, activeStudent } = useContextStore()
  const { messages, isStreaming, addMessage, appendToLast, setStreaming, clearMessages } = useChatStore()
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const { data: course } = useQuery({
    queryKey: ['course', selectedModule, selectedPresentation],
    queryFn: () => container.dataService.getCourse(selectedModule, selectedPresentation),
    enabled: !!selectedModule && !!selectedPresentation,
  })

  const students = course?.students ?? []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return
    setError(null)
    setInput('')

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    }
    addMessage(userMsg)

    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    addMessage(assistantMsg)
    setStreaming(true)

    try {
      const ctx = buildContext(selectedModule, selectedPresentation, currentWeek, numWeeks, activeStudent, students)
      const history = [...messages, userMsg]
      for await (const chunk of container.agentService.stream(history, ctx)) {
        appendToLast(chunk)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      appendToLast('\n\n[Error: Could not complete response]')
    } finally {
      setStreaming(false)
    }
  }

  const noData = !selectedModule || !selectedPresentation

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: '#F4F3F0' }}>
      {/* Header */}
      <Toolbar sx={{ bgcolor: '#fff', borderBottom: '1px solid #E5E3DC', gap: 1.5, minHeight: '60px !important', px: 3 }}>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#0A1628', fontFamily: '"IBM Plex Sans", sans-serif', flex: 1 }}>
          AI Pedagogical Advisor
        </Typography>
        {activeStudent && (
          <Chip
            label={`Discussing #${activeStudent.id_student}`}
            size="small"
            onDelete={() => useContextStore.getState().setActiveStudent(null)}
            sx={{ bgcolor: '#FAEEDA', color: '#854F0B', fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, height: 22 }}
          />
        )}
        {selectedModule && (
          <Chip
            label={`${selectedModule} · ${selectedPresentation} · Wk ${currentWeek}`}
            size="small"
            sx={{ bgcolor: '#E1F5EE', color: '#0F6E56', fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, height: 22 }}
          />
        )}
        <IconButton size="small" onClick={clearMessages} title="Clear conversation" sx={{ color: '#9CA3AF' }}>
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      </Toolbar>

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3, pb: 1 }}>
        {noData && (
          <Alert severity="info" sx={{ borderRadius: 2, mb: 2 }}>
            Select a module and presentation in the Class Overview to provide the AI with course context.
          </Alert>
        )}

        {error && (
          <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {messages.length === 0 && (
          <Box sx={{ textAlign: 'center', pt: 6 }}>
            <Typography sx={{ fontSize: 13, color: '#9CA3AF', fontFamily: '"IBM Plex Sans", sans-serif', mb: 3 }}>
              Ask about student risk, intervention strategies, or engagement patterns.
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
              {SUGGESTED_PROMPTS.map((p) => (
                <Chip
                  key={p}
                  label={p}
                  onClick={() => sendMessage(p)}
                  clickable
                  sx={{
                    fontSize: 12,
                    fontFamily: '"IBM Plex Sans", sans-serif',
                    bgcolor: '#fff',
                    border: '1px solid #E5E3DC',
                    '&:hover': { bgcolor: '#F4F3F0' },
                    height: 'auto',
                    py: 0.5,
                    '& .MuiChip-label': { whiteSpace: 'normal' },
                  }}
                />
              ))}
            </Box>
          </Box>
        )}

        {messages.map((msg, i) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && i === messages.length - 1 && msg.role === 'assistant'}
          />
        ))}
        <div ref={bottomRef} />
      </Box>

      {/* Input */}
      <Paper
        elevation={0}
        sx={{ p: 2, borderTop: '1px solid #E5E3DC', bgcolor: '#fff', display: 'flex', gap: 1.5, alignItems: 'flex-end' }}
      >
        <TextField
          multiline
          maxRows={4}
          fullWidth
          placeholder="Ask about your students…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input) }
          }}
          disabled={isStreaming}
          sx={{
            '& .MuiOutlinedInput-root': { borderRadius: 2, fontSize: 13, fontFamily: '"IBM Plex Sans", sans-serif' },
          }}
        />
        <IconButton
          onClick={() => sendMessage(input)}
          disabled={isStreaming || !input.trim()}
          sx={{
            bgcolor: '#0F6E56',
            color: '#fff',
            borderRadius: 2,
            width: 44,
            height: 44,
            flexShrink: 0,
            '&:hover': { bgcolor: '#085041' },
            '&.Mui-disabled': { bgcolor: '#E5E3DC', color: '#9CA3AF' },
          }}
        >
          {isStreaming ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SendIcon fontSize="small" />}
        </IconButton>
      </Paper>
    </Box>
  )
}
