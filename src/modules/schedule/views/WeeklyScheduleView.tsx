import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Typography, Paper, Button, Chip, Stack, Alert } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { weekRange } from '../../../shared/scheduleAnchors'
import { eventBadge } from '../eventDisplay'
import { ScheduleEventDialog } from '../components/ScheduleEventDialog'
import type { ScheduleEvent } from '../../../types/domain'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function WeeklyScheduleView() {
  const { selectedModule, selectedPresentation, currentWeek } = useContextStore()
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleEvent | null>(null)
  const [addDate, setAddDate] = useState<string>('')

  const range = useMemo(() => {
    if (!selectedPresentation) return null
    try { return weekRange(selectedPresentation, currentWeek) } catch { return null }
  }, [selectedPresentation, currentWeek])

  const load = useCallback(async () => {
    if (!selectedModule || !selectedPresentation) return
    setError(null)
    try {
      const all = await container.scheduleService.list(selectedModule, selectedPresentation)
      setEvents(all)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule')
    }
  }, [selectedModule, selectedPresentation])

  useEffect(() => { load() }, [load])

  const days = useMemo(() => {
    if (!range) return []
    const start = new Date(range.start).getTime()
    return DAY_LABELS.map((label, i) => {
      const dayStart = start + i * DAY_MS
      const dayEnd = dayStart + DAY_MS
      const dayEvents = events.filter((e) => {
        const t = new Date(e.date).getTime()
        return t >= dayStart && t < dayEnd
      })
      return { label, iso: new Date(dayStart).toISOString(), date: new Date(dayStart), events: dayEvents }
    })
  }, [range, events])

  async function handleSave(data: Omit<ScheduleEvent, '_id' | 'created_at'>) {
    if (editing?._id) await container.scheduleService.update(editing._id, data)
    else await container.scheduleService.create(data)
    await load()
  }

  async function handleDelete() {
    if (!editing?._id) return
    await container.scheduleService.remove(editing._id)
    setDialogOpen(false); setEditing(null)
    await load()
  }

  async function toggleStatus(e: ScheduleEvent, status: 'done' | 'dismissed') {
    if (!e._id) return
    await container.scheduleService.update(e._id, { status })
    await load()
  }

  if (!selectedModule || !selectedPresentation) {
    return <Box sx={{ p: 3 }}><Alert severity="info">Select a module and presentation to view the schedule.</Alert></Box>
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Weekly Schedule · Week {currentWeek}</Typography>
        <Button startIcon={<AddIcon />} variant="contained" sx={{ ml: 'auto' }}
          onClick={() => { setEditing(null); setAddDate(range?.start ?? new Date().toISOString()); setDialogOpen(true) }}>
          Add event
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 1 }}>
        {days.map((day) => (
          <Paper key={day.label} variant="outlined" sx={{ p: 1, minHeight: 160 }}>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary' }}>
              {day.label} {day.date.getUTCDate()}/{day.date.getUTCMonth() + 1}
            </Typography>
            <Stack spacing={0.5} sx={{ mt: 1 }}>
              {day.events.map((e) => {
                const badge = eventBadge(e)
                const done = e.kind === 'task' && e.status !== 'open'
                return (
                  <Paper key={e._id} onClick={() => { setEditing(e); setDialogOpen(true) }}
                    sx={{ p: 0.75, cursor: 'pointer', borderLeft: `3px solid ${badge.color}`, opacity: done ? 0.5 : 1 }}>
                    <Typography sx={{ fontSize: 11 }}>{badge.emoji} {e.title}</Typography>
                    <Chip label={badge.label} size="small" sx={{ height: 16, fontSize: 9, mt: 0.25 }} />
                    {e.kind === 'task' && e.status === 'open' && (
                      <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5 }}>
                        <Button size="small" sx={{ fontSize: 9, minWidth: 0 }} onClick={(ev) => { ev.stopPropagation(); toggleStatus(e, 'done') }}>Done</Button>
                        <Button size="small" sx={{ fontSize: 9, minWidth: 0 }} onClick={(ev) => { ev.stopPropagation(); toggleStatus(e, 'dismissed') }}>Dismiss</Button>
                      </Box>
                    )}
                  </Paper>
                )
              })}
            </Stack>
          </Paper>
        ))}
      </Box>

      <ScheduleEventDialog
        open={dialogOpen}
        initial={editing ?? { module: selectedModule, presentation: selectedPresentation }}
        defaultDate={editing?.date ?? addDate}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        onSave={handleSave}
        onDelete={editing?._id ? handleDelete : undefined}
      />
    </Box>
  )
}
