import { useEffect, useState } from 'react'
import { Box, Typography, Paper, Button, Stack, Alert } from '@mui/material'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { useChatStore } from '../../../shared/stores/chatStore'
import { computeSuggestions, type SuggestionCard } from '../../schedule/signals/suggestionRules'
import { weekToDate } from '../../../shared/scheduleAnchors'

export function SuggestionsPanel({ onTaskCreated }: { onTaskCreated: () => void }) {
  const { selectedModule, selectedPresentation, currentWeek, setChatPanelOpen } = useContextStore()
  const setPendingPrompt = useChatStore((s) => s.setPendingPrompt)
  const [cards, setCards] = useState<SuggestionCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    if (!selectedModule || !selectedPresentation) { setCards([]); return }
    container.dataService.getCourse(selectedModule, selectedPresentation)
      .then((course) => { if (active) setCards(computeSuggestions(course, currentWeek)) })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : 'Failed to compute suggestions') })
    return () => { active = false }
  }, [selectedModule, selectedPresentation, currentWeek])

  async function accept(card: SuggestionCard) {
    setBusyId(card.id); setError(null)
    try {
      await container.scheduleService.create({
        module: selectedModule, presentation: selectedPresentation,
        kind: 'task', title: card.defaultTask.title,
        date: weekToDate(selectedPresentation, currentWeek),
        week: currentWeek, source: 'suggestion', status: 'open',
        student_id: card.defaultTask.student_id,
      })
      setCards((cs) => cs.filter((c) => c.id !== card.id))
      onTaskCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create task')
    } finally {
      setBusyId(null)
    }
  }

  function askAgent(card: SuggestionCard) {
    setPendingPrompt(`${card.title}. ${card.detail} Review the affected student(s) and propose interventions.`)
    setChatPanelOpen(true)
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Suggested actions</Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {cards.length === 0 && <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Nothing needs attention this week.</Typography>}
      <Stack spacing={1}>
        {cards.map((card) => (
          <Paper key={card.id} variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ mr: 'auto' }}>
              <Typography sx={{ fontWeight: 600, fontSize: 14 }}>💡 {card.title}</Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{card.detail}</Typography>
            </Box>
            <Button variant="outlined" size="small" sx={{ mr: 1 }} onClick={() => askAgent(card)}>
              Ask agent
            </Button>
            <Button variant="contained" size="small" disabled={busyId === card.id} onClick={() => accept(card)}>
              {busyId === card.id ? 'Adding…' : 'Add to schedule'}
            </Button>
          </Paper>
        ))}
      </Stack>
    </Box>
  )
}
