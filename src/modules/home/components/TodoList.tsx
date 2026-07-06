import { useCallback, useEffect, useState } from 'react'
import { Box, Typography, Paper, Stack, Chip, Button, Alert } from '@mui/material'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { eventBadge } from '../../schedule/eventDisplay'
import { inCourseWindow } from '../../schedule/agenda'
import type { ScheduleEvent } from '../../../types/domain'

export function TodoList({ reloadKey }: { reloadKey: number }) {
  const { currentWeek } = useContextStore()
  const [items, setItems] = useState<ScheduleEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const all = await container.scheduleService.listAll()
      const visible = all.filter((e) =>
        (e.kind === 'task' && e.status === 'open') ||
        ((e.kind === 'class' || e.kind === 'lecture') && inCourseWindow(e, currentWeek, 0, 4)))
      visible.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      setItems(visible)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load to-do list')
    }
  }, [currentWeek])

  useEffect(() => { load() }, [load, reloadKey])

  async function markDone(e: ScheduleEvent) {
    if (!e._id) return
    setError(null)
    try {
      await container.scheduleService.update(e._id, { status: 'done' })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update task')
    }
  }

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>To-do</Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {items.length === 0 && <Typography sx={{ color: 'text.secondary', fontSize: 13 }}>Nothing upcoming.</Typography>}
      <Stack spacing={1}>
        {items.map((e) => {
          const badge = eventBadge(e)
          return (
            <Paper key={e._id} variant="outlined" sx={{ p: 1.25, display: 'flex', alignItems: 'center' }}>
              <Box sx={{ mr: 'auto' }}>
                <Typography sx={{ fontSize: 13 }}>{badge.emoji} {e.title}</Typography>
                <Typography sx={{ fontSize: 11, color: 'text.secondary' }}>
                  {new Date(e.date).toLocaleDateString()} · {e.module} {e.presentation} · <Chip component="span" label={badge.label} size="small" sx={{ height: 16, fontSize: 9 }} />
                </Typography>
              </Box>
              {e.kind === 'task' && e.status === 'open' &&
                <Button size="small" onClick={() => markDone(e)}>Done</Button>}
            </Paper>
          )
        })}
      </Stack>
    </Box>
  )
}
