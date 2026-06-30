import { useState } from 'react'
import { Paper, Box, Typography, Button, TextField, Stack } from '@mui/material'
import type { ProposedAction, ApprovalDecision } from '../../../types/domain'

export function ProposedActionCard({ action, onDecision }: {
  action: ProposedAction
  onDecision: (d: ApprovalDecision) => void
}) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(String(action.input.title ?? ''))
  const [body, setBody] = useState(String(action.input.body ?? action.input.note ?? ''))

  const bodyKey = action.tool === 'send_notification' ? 'body' : 'note'

  function approve() {
    onDecision({ action: 'approve', input: { ...action.input, title, [bodyKey]: body } })
  }

  return (
    <Paper variant="outlined" sx={{ p: 1.5, my: 1, borderColor: '#ef6c00', borderLeft: '3px solid #ef6c00' }}>
      <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#ef6c00', textTransform: 'uppercase', mb: 0.5 }}>
        {action.tool === 'send_notification' ? 'Proposed notification' : 'Proposed task'}
      </Typography>
      <Typography sx={{ fontSize: 13, mb: 1 }}>{action.preview}</Typography>

      {editing && (
        <Stack spacing={1} sx={{ mb: 1 }}>
          <TextField size="small" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField size="small" label={bodyKey === 'body' ? 'Body' : 'Note'} value={body} multiline minRows={2}
            onChange={(e) => setBody(e.target.value)} />
        </Stack>
      )}

      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="contained" onClick={approve}>Approve</Button>
        <Button size="small" onClick={() => setEditing((v) => !v)}>{editing ? 'Done editing' : 'Edit'}</Button>
        <Button size="small" color="error" onClick={() => onDecision({ action: 'reject' })}>Reject</Button>
      </Box>
    </Paper>
  )
}
