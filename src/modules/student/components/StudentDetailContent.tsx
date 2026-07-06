import { Grid } from '@mui/material'
import type { StudentProfile } from '../../../types/domain'
import { StudentDemographicsCard } from './StudentDemographicsCard'
import { RiskTrajectoryChart } from './RiskTrajectoryChart'
import { VleActivityChart } from './VleActivityChart'
import { AssessmentPanel } from './AssessmentPanel'
import { StudentNotesCard } from './StudentNotesCard'
import { MasteryGraphCard } from './MasteryGraphCard'

export interface StudentDetailContentProps {
  student: StudentProfile
  module: string
  presentation: string
  currentWeek: number
}

export function StudentDetailContent({ student, module, currentWeek }: StudentDetailContentProps) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Grid container spacing={2} sx={{ height: '100%' }}>
          <Grid item xs={12}><StudentDemographicsCard student={student} /></Grid>
          <Grid item xs={12}><StudentNotesCard studentId={student.id_student} /></Grid>
        </Grid>
      </Grid>
      <Grid item xs={12} md={8}>
        <Grid container spacing={2}>
          <Grid item xs={12}><RiskTrajectoryChart student={student} currentWeek={currentWeek} /></Grid>
          <Grid item xs={12}><VleActivityChart student={student} currentWeek={currentWeek} /></Grid>
          <Grid item xs={12}><AssessmentPanel student={student} currentWeek={currentWeek} /></Grid>
          <Grid item xs={12}><MasteryGraphCard student={student} module={module} /></Grid>
        </Grid>
      </Grid>
    </Grid>
  )
}
