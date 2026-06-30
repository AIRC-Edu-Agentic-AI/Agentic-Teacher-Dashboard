import { useEffect, useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  MenuItem, Stack, Alert,
} from '@mui/material'
import type { ScheduleEvent, ScheduleEventKind, ClassType } from '../../../types/domain'

export interface ScheduleEventDialogProps {
  open: boolean
  initial?: Partial<ScheduleEvent>
  defaultDate: string                 // ISO, used when creating
  onClose: () => void
  onSave: (data: Omit<ScheduleEvent, '_id' | 'created_at'>) => Promise<void>
  onDelete?: () => Promise<void>      // present only when editing
}

const KINDS: ScheduleEventKind[] = ['class', 'lecture', 'task']
const CLASS_TYPES: ClassType[] = ['Regular', 'Makeup']

export function ScheduleEventDialog(props: ScheduleEventDialogProps) {
  const { open, initial, defaultDate, onClose, onSave, onDelete } = props
  const [kind, setKind] = useState<ScheduleEventKind>('class')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate.slice(0, 10))
  const [classroom, setClassroom] = useState('')
  const [classType, setClassType] = useState<ClassType>('Regular')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setKind((initial?.kind as ScheduleEventKind) ?? 'class')
    setTitle(initial?.title ?? '')
    setDate((initial?.date ?? defaultDate).slice(0, 10))
    setClassroom(initial?.classroom ?? '')
    setClassType((initial?.class_type as ClassType) ?? 'Regular')
    setError(null)
  }, [open, initial, defaultDate])

  async function handleSave() {
    setSaving(true); setError(null)
    try {
      const data: Omit<ScheduleEvent, '_id' | 'created_at'> = {
        module: initial!.module!, presentation: initial!.presentation!,
        kind, title: title.trim(), date: new Date(`${date}T09:00:00.000Z`).toISOString(),
        week: initial?.week ?? null,
        ...(kind === 'class' ? { classroom: classroom.trim(), class_type: classType } : {}),
        ...(kind === 'task' ? { source: initial?.source ?? 'manual', status: initial?.status ?? 'open', student_id: initial?.student_id ?? null } : {}),
      }
      await onSave(data)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{initial?._id ? 'Edit event' : 'Add event'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField select label="Kind" value={kind} onChange={(e) => setKind(e.target.value as ScheduleEventKind)} disabled={!!initial?._id}>
            {KINDS.map((k) => <MenuItem key={k} value={k}>{k}</MenuItem>)}
          </TextField>
          <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          {kind === 'class' && (
            <>
              <TextField label="Classroom" value={classroom} onChange={(e) => setClassroom(e.target.value)} />
              <TextField select label="Class type" value={classType} onChange={(e) => setClassType(e.target.value as ClassType)}>
                {CLASS_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </>
          )}
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        {onDelete && <Button color="error" onClick={onDelete} sx={{ mr: 'auto' }}>Delete</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={saving || !title.trim()} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
