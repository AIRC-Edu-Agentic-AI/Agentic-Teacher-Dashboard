import { describe, it, expect } from 'vitest'
import { listAtRiskStudents, getStudentDetail } from './readTools'
import type { ProcessedCourse, StudentProfile } from '../../../types/domain'

function student(id: number, over: Partial<StudentProfile>): StudentProfile {
  return {
    id_student: id, gender: 'M', region: 'r', highest_education: 'e', imd_band: 'b',
    age_band: 'a', num_of_prev_attempts: 0, studied_credits: 60, disability: false,
    final_result: 'Pass', date_registration: -30, date_unregistration: null,
    weekly_clicks: [], decayed_engagement: [], assessments: [],
    risk_by_week: [], tier_by_week: [], lstm_trajectories: null,
    ...over,
  }
}

// week 3 -> index 2
const course: ProcessedCourse = {
  module: 'AAA', presentation: '2013J', num_weeks: 39,
  cohort_p75_decayed: [0, 0, 50],
  students: [
    student(11, { tier_by_week: [1, 2, 3], risk_by_week: [0.2, 0.5, 0.8], decayed_engagement: [80, 40, 10],
      assessments: [{ id_assessment: 101, assessment_type: 'TMA', date_due: 10, weight: 10, score: null, date_submitted: null }] }),
    student(12, { tier_by_week: [1, 1, 1], risk_by_week: [0.1, 0.1, 0.1], decayed_engagement: [80, 80, 90] }),
  ],
}

describe('listAtRiskStudents', () => {
  it('ranks tier-3/2 students above tier-1 and caps the list', () => {
    const result = listAtRiskStudents(course, 3, 1)
    expect(result).toHaveLength(1)
    expect(result[0].id_student).toBe(11)
    expect(result[0].tier).toBe(3)
  })
})

describe('getStudentDetail', () => {
  it('returns current/previous tier and past-due unsubmitted assessments', () => {
    const d = getStudentDetail(course, 11, 3)!
    expect(d.tier_now).toBe(3)
    expect(d.tier_prev).toBe(2)
    expect(d.missing_assessments).toEqual([101])  // due day 10 <= week-3 day 14, not submitted
    expect(d.cohort_p75).toBe(50)
  })
  it('returns null for an unknown student', () => {
    expect(getStudentDetail(course, 999, 3)).toBeNull()
  })
})
