import type { ProcessedCourse, StudentProfile } from '../../../types/domain'

// Domain arrays are 0-indexed at week 1, so week W is index W - 1.
const at = <T>(arr: T[], week: number): T | undefined => arr[week - 1]

export interface AtRiskStudent {
  id_student: number
  tier: number
  risk: number
  decayed_engagement: number
}

export function listAtRiskStudents(course: ProcessedCourse, week: number, limit = 10): AtRiskStudent[] {
  const rows: AtRiskStudent[] = course.students.map((s) => ({
    id_student: s.id_student,
    tier: at(s.tier_by_week, week) ?? 1,
    risk: at(s.risk_by_week, week) ?? 0,
    decayed_engagement: at(s.decayed_engagement, week) ?? 0,
  }))
  return rows
    .filter((r) => r.tier >= 2)
    .sort((a, b) => b.tier - a.tier || b.risk - a.risk)
    .slice(0, limit)
}

const LSTM_WINDOWS = ['w25', 'w20', 'w15', 'w10', 'w05'] as const

function lstmForecast(s: StudentProfile): number | null {
  if (!s.lstm_trajectories) return null
  for (const key of LSTM_WINDOWS) {
    const arr = s.lstm_trajectories[key]
    if (!arr) continue
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i] != null) return arr[i] as number
    }
  }
  return null
}

export interface StudentDetail {
  id_student: number
  tier_now: number | null
  tier_prev: number | null
  risk_now: number | null
  engagement_now: number | null
  cohort_p75: number | null
  missing_assessments: number[]
  lstm_forecast: number | null
}

export function getStudentDetail(course: ProcessedCourse, studentId: number, week: number): StudentDetail | null {
  const s = course.students.find((st) => st.id_student === studentId)
  if (!s) return null
  const weekDay = (week - 1) * 7
  const missing = s.assessments
    .filter((a) => a.date_due != null && a.date_due <= weekDay && a.date_submitted == null)
    .map((a) => a.id_assessment)
  return {
    id_student: s.id_student,
    tier_now: at(s.tier_by_week, week) ?? null,
    tier_prev: week >= 2 ? at(s.tier_by_week, week - 1) ?? null : null,
    risk_now: at(s.risk_by_week, week) ?? null,
    engagement_now: at(s.decayed_engagement, week) ?? null,
    cohort_p75: at(course.cohort_p75_decayed, week) ?? null,
    missing_assessments: missing,
    lstm_forecast: lstmForecast(s),
  }
}
