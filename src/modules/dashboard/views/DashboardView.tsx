import { useEffect } from 'react'
import { Box, Typography, CircularProgress, Alert, Toolbar, Grid } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'
import { RiskTilesRow } from '../components/RiskTilesRow'
import { TierDistributionChart } from '../components/TierDistributionChart'
import { MarkDistributionChart } from '../components/MarkDistributionChart'
import { StudentRiskTable } from '../components/StudentRiskTable'
import { CourseInfoSections } from '../components/CourseInfoSections'
import { CourseSchedule } from '../components/CourseSchedule'
import './DashboardView.css'
import type { StudentProfile } from '../../../types/domain'

export function DashboardView() {
  const navigate = useNavigate()
  const { selectedModule, selectedPresentation, currentWeek, setNumWeeks, setActiveStudent } = useContextStore()

  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', selectedModule, selectedPresentation],
    queryFn: () => container.dataService.getCourse(selectedModule, selectedPresentation),
    enabled: !!selectedModule && !!selectedPresentation,
  })

  useEffect(() => {
    if (course) setNumWeeks(course.num_weeks)
  }, [course, setNumWeeks])

  const numWeeks = course?.num_weeks ?? 39
  const students = course?.students ?? []

  const handleStudentSelect = (s: StudentProfile) => {
    setActiveStudent(s)
    navigate(`/student/${s.id_student}`)
  }

  return (
    <Box className="dashboard-container">
      <Toolbar className="dashboard-header">
        <Typography className="dashboard-header-title">Analytics Dashboard</Typography>
      </Toolbar>

      <Box className="dashboard-content-scroll">
        {courseLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <CircularProgress size={20} thickness={5} sx={{ color: '#1D9E75' }} />
            <Typography variant="body2" color="text.secondary">Loading class data...</Typography>
          </Box>
        )}

        {students.length > 0 && (
          <>
            <RiskTilesRow students={students} currentWeek={currentWeek} />

            <Box className="dashboard-main-grid">
              <StudentRiskTable
                students={students}
                currentWeek={currentWeek}
                onSelect={handleStudentSelect}
                selectedId={useContextStore.getState().activeStudent?.id_student ?? null}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TierDistributionChart students={students} numWeeks={numWeeks} currentWeek={currentWeek} />
                <MarkDistributionChart students={students} currentWeek={currentWeek} />
              </Box>
            </Box>

            <Typography className="dashboard-management-title">
              Course Administration — {selectedModule}
            </Typography>
            
            {/* Alignment for Schedule and Assignments */}
            <Grid container spacing={3} sx={{ pb: 4 }}>
              <Grid item xs={12} lg={7}>
                <Box className="dashboard-section-card" sx={{ height: '100%' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: '#334155' }}>
                    Weekly Course Schedule
                  </Typography>
                  <CourseSchedule />
                </Box>
              </Grid>
              <Grid item xs={12} lg={5}>
                <Box className="dashboard-section-card" sx={{ height: '100%' }}>
                  <CourseInfoSections />
                </Box>
              </Grid>
            </Grid>
          </>
        )}
      </Box>
    </Box>
  )
}