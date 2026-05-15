import { useEffect } from 'react'
import { Box, Typography, CircularProgress, Alert, Toolbar, Grid } from '@mui/material' // Added Grid
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { container } from '../../../di/container'
import { useContextStore } from '../../../shared/stores/contextStore'

// Internal Components
import { RiskTilesRow } from '../components/RiskTilesRow'
import { TierDistributionChart } from '../components/TierDistributionChart'
import { MarkDistributionChart } from '../components/MarkDistributionChart'
import { StudentRiskTable } from '../components/StudentRiskTable'
import { CourseInfoSections } from '../components/CourseInfoSections'
import { CourseSchedule } from '../components/CourseSchedule' // Import the new component

// Styles and Types
import './DashboardView.css'
import type { StudentProfile } from '../../../types/domain'

export function DashboardView() {
  const navigate = useNavigate()
  const { selectedModule, selectedPresentation, currentWeek, setNumWeeks, setActiveStudent } = useContextStore()

  // Data fetching: Index info
  const { error: indexError } = useQuery({
    queryKey: ['oulad-index'],
    queryFn: () => container.dataService.getIndex(),
    retry: false,
  })

  // Data fetching: Course details
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ['course', selectedModule, selectedPresentation],
    queryFn: () => container.dataService.getCourse(selectedModule, selectedPresentation),
    enabled: !!selectedModule && !!selectedPresentation,
  })

  // Sync week count to global state
  useEffect(() => {
    if (course) setNumWeeks(course.num_weeks)
  }, [course, setNumWeeks])

  const numWeeks = course?.num_weeks ?? 39
  const students = course?.students ?? []

  const handleStudentSelect = (s: StudentProfile) => {
    setActiveStudent(s)
    navigate(`/student/${s.id_student}`)
  }

  // Handle data-not-found scenario
  if (indexError) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          <strong>No preprocessed data found.</strong><br />
          Place OULAD CSV files in <code>public/data/oulad/</code> and run <code>npm run preprocess</code>.
        </Alert>
      </Box>
    )
  }

  return (
    <Box className="dashboard-container">
      {/* Top Header Section */}
      <Toolbar className="dashboard-header" sx={{ px: 3 }}>
        <Typography className="dashboard-header-title">
          Class Overview
        </Typography>
      </Toolbar>

      <Box className="dashboard-content-scroll" sx={{ p: 3 }}>
        {/* Loading Indicator */}
        {courseLoading && (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 3 }}>
            <CircularProgress size={18} sx={{ color: '#1D9E75' }} />
            <Typography sx={{ fontSize: 13, color: '#6B7280', fontFamily: '"IBM Plex Mono", monospace' }}>
              Loading OULAD data…
            </Typography>
          </Box>
        )}

        {/* Dashboard Main Content */}
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
              
              <Box className="dashboard-chart-column">
                <TierDistributionChart students={students} numWeeks={numWeeks} currentWeek={currentWeek} />
                <MarkDistributionChart students={students} currentWeek={currentWeek} />
              </Box>
            </Box>

            {/* Management Information Section */}
            <Typography className="dashboard-management-title" sx={{ mt: 4, mb: 2 }}>
              Course Management - {selectedModule} ({selectedPresentation})
            </Typography>
            
            {/* Split layout for Schedule and Assignments */}
            <Grid container spacing={3}>
              <Grid item xs={12} lg={7}>
                {/* Updated CourseSchedule will show lecture links and descriptions */}
                <CourseSchedule />
              </Grid>
              <Grid item xs={12} lg={5}>
                {/* Existing assignments timeline */}
                <CourseInfoSections />
              </Grid>
            </Grid>
          </>
        )}
      </Box>
    </Box>
  )
}