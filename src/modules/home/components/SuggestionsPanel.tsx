import { useEffect, useState } from 'react'
import { Box, Typography, Paper, Button, Stack, Alert, Chip } from '@mui/material'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { useChatStore } from '../../../shared/stores/chatStore'
import { aggregateSuggestions, type CourseSuggestion } from '../../schedule/signals/suggestionRules'
import { weekToDate } from '../../../shared/scheduleAnchors'

const keyOf = (s: CourseSuggestion) => `${s.module}/${s.presentation}/${s.card.id}`

export function SuggestionsPanel({ onTaskCreated }: { onTaskCreated: () => void }) {
  const { currentWeek, setModule, setPresentation, setChatPanelOpen } = useContextStore()
  const setPendingPrompt = useChatStore((s) => s.setPendingPrompt)
  const [items, setItems] = useState<CourseSuggestion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    container.dataService.getAllCourses()
      .then((courses) => { if (active) setItems(aggregateSuggestions(courses, currentWeek)) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Failed to compute suggestions') })
    return () => { active = false }
  }, [currentWeek])

  async function accept(s: CourseSuggestion) {
    setBusyKey(keyOf(s)); setError(null)
    try {
      await container.scheduleService.create({
        module: s.module, presentation: s.presentation,
        kind: 'task', title: s.card.defaultTask.title,
        date: weekToDate(s.presentation, currentWeek),
        week: currentWeek, source: 'suggestion', status: 'open',
        student_id: s.card.defaultTask.student_id,
      })
      setItems((cs) => cs.filter((c) => keyOf(c) !== keyOf(s)))
      onTaskCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task')
    } finally {
      setBusyKey(null)
    }
  }

  function askAgent(s: CourseSuggestion) {
    // Align global course context to this card's course so the agent reasons over it.
    setModule(s.module)
    setPresentation(s.presentation)
    setPendingPrompt(`${s.card.title}. ${s.card.detail} Review the affected student(s) in ${s.module} ${s.presentation} and propose interventions.`)
    setChatPanelOpen(true)
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Suggested actions</Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {items.length === 0 && <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Nothing needs attention this week.</Typography>}
      <Stack spacing={1}>
        {items.map((s) => (
          <Paper key={keyOf(s)} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ mr: 'auto' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>💡 {s.card.title}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s.card.detail}</Typography>
              <Chip label={`${s.module} ${s.presentation}`} size="small" sx={{ mt: 0.5, height: 18, fontSize: 10 }} />
            </Box>
            <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={() => askAgent(s)}>Ask agent</Button>
            <Button variant="contained" size="small" disabled={busyKey === keyOf(s)} onClick={() => accept(s)}>
              {busyKey === keyOf(s) ? 'Adding…' : 'Add to schedule'}
            </Button>
          </Paper>
        ))}
      </Stack>
    </Box>
  )
}
