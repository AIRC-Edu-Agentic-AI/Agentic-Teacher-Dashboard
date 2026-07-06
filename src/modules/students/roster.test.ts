import { describe, it, expect } from 'vitest'
import { buildRoster, filterAndSortRoster } from './roster'
import type { ProcessedCourse, StudentProfile } from '../../types/domain'

function student(id: number, over: Partial<StudentProfile>): StudentProfile {
  return {
    id_student: id, gender: 'M', region: 'r', highest_education: 'e', imd_band: 'b',
    age_band: 'a', num_of_prev_attempts: 0, studied_credits: 60, disability: false,
    final_result: 'Pass', date_registration: -30, date_unregistration: null,
    weekly_clicks: [], decayed_engagement: [], assessments: [],
    risk_by_week: [], tier_by_week: [], lstm_trajectories: null, ...over,
  }
}
function course(module: string, students: StudentProfile[]): ProcessedCourse {
  return { module, presentation: '2013J', num_weeks: 39, cohort_p75_decayed: [], students }
}

// week 3 -> index 2
const courses: ProcessedCourse[] = [
  course('AAA', [student(11, { tier_by_week: [1, 2, 3], risk_by_week: [0.1, 0.4, 0.8], decayed_engagement: [80, 40, 10], final_result: 'Fail' })]),
  course('BBB', [student(22, { tier_by_week: [1, 1, 1], risk_by_week: [0.1, 0.1, 0.2], decayed_engagement: [70, 70, 60], final_result: 'Pass' })]),
]

describe('buildRoster', () => {
  it('flattens all courses using week-indexed values', () => {
    const rows = buildRoster(courses, 3)
    expect(rows).toHaveLength(2)
    const a = rows.find((r) => r.id_student === 11)!
    expect(a).toMatchObject({ module: 'AAA', tier: 3, risk: 0.8, decayed_engagement: 10, final_result: 'Fail' })
  })
})

describe('filterAndSortRoster', () => {
  const rows = buildRoster(courses, 3)
  it('filters by module', () => {
    expect(filterAndSortRoster(rows, { module: 'BBB' }, { key: 'risk', dir: 'desc' })).toHaveLength(1)
  })
  it('filters by tier and final_result', () => {
    expect(filterAndSortRoster(rows, { tier: 3 }, { key: 'risk', dir: 'desc' })[0].id_student).toBe(11)
    expect(filterAndSortRoster(rows, { final_result: 'Pass' }, { key: 'risk', dir: 'desc' })[0].id_student).toBe(22)
  })
  it('filters by id substring search', () => {
    expect(filterAndSortRoster(rows, { search: '22' }, { key: 'risk', dir: 'desc' })).toHaveLength(1)
  })
  it('sorts by risk descending then ascending', () => {
    expect(filterAndSortRoster(rows, {}, { key: 'risk', dir: 'desc' }).map((r) => r.id_student)).toEqual([11, 22])
    expect(filterAndSortRoster(rows, {}, { key: 'risk', dir: 'asc' }).map((r) => r.id_student)).toEqual([22, 11])
  })
})
