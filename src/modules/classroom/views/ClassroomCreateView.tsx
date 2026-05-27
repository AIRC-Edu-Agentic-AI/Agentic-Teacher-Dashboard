import { useState } from 'react'
import {
  Box, Typography, TextField, Button, Toolbar
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded'
import { container } from '../../../di/container'
import { useQueryClient } from '@tanstack/react-query'

export function ClassroomCreateView() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [module, setModule] = useState('')
  const [presentation, setPresentation] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleCreate = async () => {
    if (!name || !module || !presentation) {
      setError('Name, module and presentation are required')
      return
    }
    setLoading(true)
    setError('')
    try {
      await container.classroomService.createClassroom({
        name,
        module,
        code_presentation: presentation,
        description,
        is_custom: true, // Always custom
      })
      await queryClient.invalidateQueries({ queryKey: ['classrooms'] })
      await queryClient.invalidateQueries({ queryKey: ['oulad-index'] })
      navigate('/classroom')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ bgcolor: '#fff', borderBottom: '1px solid #E5E3DC', gap: 2, minHeight: '60px !important', px: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/classroom')} size="small" sx={{ color: '#6B7280', fontSize: 12 }}>
          Classrooms
        </Button>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: '#0A1628', fontFamily: '"IBM Plex Sans", sans-serif' }}>
          New Classroom
        </Typography>
      </Toolbar>

      <Box sx={{ p: 3, maxWidth: 480 }}>
        {error && <Typography sx={{ color: '#E24B4A', fontSize: 12, mb: 2 }}>{error}</Typography>}

        <TextField fullWidth label="Classroom name" size="small" value={name}
          onChange={e => setName(e.target.value)} sx={{ mb: 2 }} />

        <TextField fullWidth label="Module name" size="small" value={module}
          onChange={e => setModule(e.target.value)} sx={{ mb: 2 }} placeholder="e.g. CS101" />

        <TextField fullWidth label="Presentation" size="small" value={presentation}
          onChange={e => setPresentation(e.target.value)} sx={{ mb: 2 }} placeholder="e.g. 2025J"
          helperText="You'll be able to upload student CSV after creating the classroom." />

        <TextField fullWidth label="Description (optional)" size="small" multiline rows={3}
          value={description} onChange={e => setDescription(e.target.value)} sx={{ mb: 3 }} />

        <Button fullWidth variant="contained" onClick={handleCreate} disabled={loading}
          sx={{ bgcolor: '#0F6E56', '&:hover': { bgcolor: '#085041' }, py: 1.2, fontSize: 13 }}>
          {loading ? 'Creating…' : 'Create classroom'}
        </Button>
      </Box>
    </Box>
  )
}