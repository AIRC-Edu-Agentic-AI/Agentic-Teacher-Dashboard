import { Drawer, Box, Typography, IconButton, Button } from '@mui/material'
import CloseIcon from '@mui/icons-material/CloseRounded'
import ChatIcon from '@mui/icons-material/ChatBubbleOutlineRounded'
import { tokens } from '../../../theme'
import { useContextStore } from '../../../shared/stores/contextStore'
import { StudentDetailContent } from './StudentDetailContent'

export function StudentDetailDrawer() {
  const { detailTarget, closeStudentDetail, currentWeek, setActiveStudent, setChatPanelOpen } = useContextStore()

  function discuss() {
    if (!detailTarget) return
    setActiveStudent(detailTarget.student)
    setChatPanelOpen(true)
    closeStudentDetail()
  }

  return (
    <Drawer
      anchor="right"
      open={detailTarget != null}
      onClose={closeStudentDetail}
      PaperProps={{ sx: { width: { xs: '100%', sm: 720 }, maxWidth: '100%' } }}
    >
      {detailTarget && (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 3, py: 1.5, borderBottom: `1px solid ${tokens.border.default}`, flexShrink: 0 }}>
            <Typography sx={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
              Student #{detailTarget.student.id_student} — {detailTarget.module} {detailTarget.presentation}
            </Typography>
            <Button size="small" variant="contained" startIcon={<ChatIcon />} onClick={discuss}
              sx={{ fontSize: 12, bgcolor: tokens.brand.primary, '&:hover': { bgcolor: tokens.brand.primaryDark } }}>
              Discuss with AI
            </Button>
            <IconButton size="small" onClick={closeStudentDetail}><CloseIcon fontSize="small" /></IconButton>
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <StudentDetailContent
              student={detailTarget.student}
              module={detailTarget.module}
              presentation={detailTarget.presentation}
              currentWeek={currentWeek}
            />
          </Box>
        </Box>
      )}
    </Drawer>
  )
}
