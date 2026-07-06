import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Button, Toolbar, CircularProgress } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import ChatIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import ArrowBackIcon from '@mui/icons-material/ArrowBackRounded'
import { container } from '../../../di/container'
import { tokens } from '../../../theme'
import { useContextStore } from '../../../shared/stores/contextStore'
import { StudentDetailContent } from '../components/StudentDetailContent'

export function StudentDetailView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { selectedModule, selectedPresentation, currentWeek, setActiveStudent, setChatPanelOpen } = useContextStore()

  const { data: student, isLoading } = useQuery({
    queryKey: ['student', selectedModule, selectedPresentation, id],
    queryFn: () => container.dataService.getStudent(selectedModule, selectedPresentation, Number(id)),
    enabled: !!selectedModule && !!selectedPresentation && !!id,
  })

  if (isLoading) return (
    <Box sx={{ display: 'flex', p: 4, gap: 1.5, alignItems: 'center' }}>
      <CircularProgress size={18} sx={{ color: tokens.brand.primaryLight }} />
      <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>
        Loading student data…
      </Typography>
    </Box>
  )

  if (!student) return (
    <Box sx={{ p: 4 }}>
      <Typography sx={{ color: tokens.brand.danger }}>Student not found. Select a module/presentation first.</Typography>
    </Box>
  )

  const handleOpenChat = () => {
    setActiveStudent(student)
    setChatPanelOpen(true)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <Toolbar sx={{ bgcolor: '#fff', borderBottom: '1px solid #E5E3DC', gap: 2, px: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} size="small" sx={{ color: tokens.text.secondary, fontSize: 12 }}>
          Overview
        </Button>
        <Typography sx={{ fontSize: 14, fontWeight: 500, color: 'text.primary', flex: 1 }}>
          Student #{student.id_student} — {selectedModule} {selectedPresentation}
        </Typography>
        <Button variant="contained" size="small" startIcon={<ChatIcon />} onClick={handleOpenChat}
          sx={{ fontSize: 12, bgcolor: tokens.brand.primary, '&:hover': { bgcolor: tokens.brand.primaryDark } }}>
          Discuss with AI
        </Button>
      </Toolbar>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        <StudentDetailContent
          student={student}
          module={selectedModule}
          presentation={selectedPresentation}
          currentWeek={currentWeek}
        />
      </Box>
    </Box>
  )
}
