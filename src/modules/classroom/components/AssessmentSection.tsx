import { useState } from 'react'
import {
  Alert, Box, Button, CircularProgress, FormControl, InputLabel,
  MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { container } from '../../../di/container'

interface Props {
  classroomId: string
}

export function AssessmentSection({ classroomId }: Props) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [type, setType] = useState('TMA')
  const [weight, setWeight] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { data: assessments = [], isLoading } = useQuery({
    queryKey: ['classroom-assessments', classroomId],
    queryFn: () => container.classroomService.getAssessments(classroomId),
    enabled: !!classroomId,
  })

  const handleAdd = async () => {
    if (!name.trim()) { setError('Assessment name is required'); return }
    const w = weight ? Number(weight) : 0
    const d = dueDate ? Number(dueDate) : null
    if (isNaN(w) || w < 0) { setError('Weight must be a valid number'); return }
    if (d !== null && (isNaN(d) || d < 0)) { setError('Due day must be a valid number'); return }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await container.classroomService.createAssessment(classroomId, {
        name, weight: w, due_date: d, assessment_type: type,
      })
      setName(''); setWeight(''); setDueDate(''); setType('TMA')
      setSuccess('Assessment added successfully')
      await queryClient.invalidateQueries({ queryKey: ['classroom-assessments', classroomId] })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box sx={{ mt: 3, borderTop: '1px solid #E5E3DC', pt: 3 }}>
      <Typography sx={{ fontSize: 13, fontWeight: 500, color: '#0A1628', mb: 1.5 }}>
        Assessments — {assessments.length} total
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>{success}</Alert>}

      <Box sx={{ border: '1px solid #E5E3DC', borderRadius: 2, p: 2, mb: 2, bgcolor: '#fff' }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 140px 120px 120px auto', gap: 1.5, alignItems: 'center' }}>
          <TextField label="Assessment name" size="small" value={name} onChange={e => setName(e.target.value)} />
          <FormControl size="small">
            <InputLabel>Type</InputLabel>
            <Select value={type} label="Type" onChange={e => setType(e.target.value)}>
              <MenuItem value="TMA">TMA</MenuItem>
              <MenuItem value="CMA">CMA</MenuItem>
              <MenuItem value="Exam">Exam</MenuItem>
            </Select>
          </FormControl>
          <TextField label="Weight" size="small" type="number" value={weight} onChange={e => setWeight(e.target.value)} />
          <TextField label="Due day" size="small" type="number" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          <Button variant="contained" size="small" disabled={saving} onClick={handleAdd}
            sx={{ bgcolor: '#0F6E56', '&:hover': { bgcolor: '#085041' }, fontSize: 12, height: 40 }}>
            {saving ? 'Adding...' : 'Add'}
          </Button>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <CircularProgress size={16} sx={{ color: '#1D9E75' }} />
          <Typography sx={{ fontSize: 13, color: '#6B7280' }}>Loading assessments...</Typography>
        </Box>
      ) : assessments.length === 0 ? (
        <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>No assessments yet.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              {['Name', 'Type', 'Weight', 'Due day'].map(h => (
                <TableCell key={h} sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 11, color: '#6B7280', bgcolor: '#F8F7F4' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {assessments.map(a => (
              <TableRow key={a._id ?? `${a.name}-${a.assessment_type}`}>
                <TableCell sx={{ fontSize: 12 }}>{a.name}</TableCell>
                <TableCell sx={{ fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' }}>{a.assessment_type}</TableCell>
                <TableCell sx={{ fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' }}>{a.weight}</TableCell>
                <TableCell sx={{ fontSize: 12, fontFamily: '"IBM Plex Mono", monospace' }}>{a.due_date ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Box>
  )
}