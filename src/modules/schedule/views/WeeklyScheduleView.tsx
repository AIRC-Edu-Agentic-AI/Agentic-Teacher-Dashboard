import { useCallback, useEffect, useMemo, useState } from 'react'
import { Box, Typography, Paper, Button, Chip, Stack, Alert } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { eventBadge } from '../eventDisplay'
import { buildAgenda } from '../agenda'
import { ScheduleEventDialog } from '../components/ScheduleEventDialog'
import type { ScheduleEvent } from '../../../types/domain'

export function WeeklyScheduleView() {
  const { currentWeek } = useContextStore()
  const [events, setEvents] = useState<ScheduleEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScheduleEvent | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setEvents(await container.scheduleService.listAll())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule')
    }
  }, [])

  useEffect(() => { load() }, [load])

  const agenda = useMemo(() => buildAgenda(events, currentWeek), [events, currentWeek])

  async function handleSave(data: Omit<ScheduleEvent, '_id' | 'created_at'>) {
    if (editing?._id) await container.scheduleService.update(editing._id, data)
    else await container.scheduleService.create(data)
    await load()
  }

  async function handleDelete() {
    if (!editing?._id) return
    try {
      await container.scheduleService.remove(editing._id)
      setDialogOpen(false); setEditing(null)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete event')
    }
  }

  async function toggleStatus(e: ScheduleEvent, status: 'done' | 'dismissed') {
    if (!e._id) return
    try {
      await container.scheduleService.update(e._id, { status })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update event')
    }
  }

  function renderRow(e: ScheduleEvent) {
    const badge = eventBadge(e)
    const done = e.kind === 'task' && e.status !== 'open'
    return (
      <Paper key={e._id} variant="outlined"
        onClick={() => { setEditing(e); setDialogOpen(true) }}
        sx={{ p: 1.25, cursor: 'pointer', borderLeft: `3px solid ${badge.color}`, opacity: done ? 0.5 : 1, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ mr: 'auto' }}>
          <Typography sx={{ fontSize: 13 }}>{badge.emoji} {e.title}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
            {new Date(e.date).toLocaleDateString()} · {e.module} {e.presentation} · <Chip component="span" label={badge.label} size="small" sx={{ height: 16, fontSize: 9 }} />
          </Typography>
        </Box>
        {e.kind === 'task' && e.status === 'open' && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" onClick={(ev) => { ev.stopPropagation(); toggleStatus(e, 'done') }}>Done</Button>
            <Button size="small" onClick={(ev) => { ev.stopPropagation(); toggleStatus(e, 'dismissed') }}>Dismiss</Button>
          </Box>
        )}
      </Paper>
    )
  }

  function section(label: string, rows: ScheduleEvent[]) {
    return (
      <Box sx={{ mb: 3 }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', mb: 1 }}>{label}</Typography>
        {rows.length === 0
          ? <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>Nothing scheduled.</Typography>
          : <Stack spacing={1}>{rows.map(renderRow)}</Stack>}
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>Weekly Schedule · Week {currentWeek}</Typography>
        <Button startIcon={<AddIcon />} variant="contained" sx={{ ml: 'auto' }}
          onClick={() => { setEditing(null); setDialogOpen(true) }}>
          Add event
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {section(`This week · week ${currentWeek}`, agenda.thisWeek)}
      {section('Upcoming · next 4 weeks', agenda.thisMonth)}

      <ScheduleEventDialog
        open={dialogOpen}
        initial={editing ?? undefined}
        defaultDate={editing?.date ?? new Date().toISOString()}
        currentWeek={currentWeek}
        onClose={() => { setDialogOpen(false); setEditing(null) }}
        onSave={handleSave}
        onDelete={editing?._id ? handleDelete : undefined}
      />
    </Box>
  )
}
