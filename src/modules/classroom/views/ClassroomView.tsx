import { Box, Typography, Button, Card, CardContent, Chip, CircularProgress } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import AddIcon from '@mui/icons-material/AddRounded'
import { container } from '../../../di/container'

export function ClassroomView() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['classrooms'],
    queryFn: () => container.classroomService.getClassrooms(),
  })

  if (isLoading) return (
    <Box sx={{ display: 'flex', p: 4, gap: 1.5, alignItems: 'center' }}>
      <CircularProgress size={18} sx={{ color: '#1D9E75' }} />
      <Typography sx={{ fontSize: 13, color: '#6B7280', fontFamily: '"IBM Plex Mono", monospace' }}>
        Loading classrooms…
      </Typography>
    </Box>
  )

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography sx={{ fontSize: 20, fontWeight: 600, color: '#0A1628', fontFamily: '"IBM Plex Sans", sans-serif' }}>
          My Classrooms
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/classroom/new')}
          sx={{ bgcolor: '#0F6E56', '&:hover': { bgcolor: '#085041' }, fontSize: 13 }}>
          New classroom
        </Button>
      </Box>

      {data?.length === 0 && (
        <Typography sx={{ color: '#6B7280', fontSize: 13 }}>No classrooms yet. Create one to get started.</Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
        {data?.map((c) => (
          <Card key={c._id} elevation={0} onClick={() => navigate(`/classroom/${c._id}`)}
            sx={{ border: '1px solid #E5E3DC', borderRadius: 2, cursor: 'pointer', '&:hover': { borderColor: '#1D9E75' } }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                <Typography sx={{ fontSize: 15, fontWeight: 600, color: '#0A1628' }}>{c.name}</Typography>
                <Chip label={c.status} size="small"
                  sx={{ bgcolor: c.status === 'active' ? '#E1F5EE' : '#F3F4F6', color: c.status === 'active' ? '#0F6E56' : '#6B7280', fontSize: 11, fontFamily: '"IBM Plex Mono", monospace' }} />
              </Box>
              <Typography sx={{ fontSize: 12, color: '#6B7280', fontFamily: '"IBM Plex Mono", monospace' }}>
                {c.module} · {c.code_presentation}
              </Typography>
              {c.description && (
                <Typography sx={{ fontSize: 12, color: '#9CA3AF', mt: 0.5 }}>{c.description}</Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  )
}