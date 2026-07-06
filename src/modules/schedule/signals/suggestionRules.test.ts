import { describe, it, expect } from 'vitest'
import { computeSuggestions } from './suggestionRules'
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

// week 3 -> index 2; week 2 -> index 1
const course: ProcessedCourse = {
  module: 'AAA', presentation: '2013J', num_weeks: 39,
  cohort_p75_decayed: [0, 0, 50],
  students: [
    // escalated tier 1 -> 3 at week 3, and engagement below cohort p75
    student(11, { tier_by_week: [1, 1, 3], decayed_engagement: [80, 80, 10] }),
    // steady, healthy
    student(12, { tier_by_week: [1, 1, 1], decayed_engagement: [80, 80, 90] }),
  ],
}

describe('computeSuggestions', () => {
  it('flags a tier escalation at the current week', () => {
    const cards = computeSuggestions(course, 3)
    const tier = cards.find(c => c.kind === 'tier-escalation')
    expect(tier).toBeDefined()
    expect(tier!.detail).toMatch(/1 student/)
  })

  it('flags an engagement drop for the dropping student only', () => {
    const cards = computeSuggestions(course, 3)
    const drops = cards.filter(c => c.kind === 'engagement-drop')
    expect(drops).toHaveLength(1)
    expect(drops[0].defaultTask.student_id).toBe(11)
  })

  it('returns no cards when nothing is wrong', () => {
    const calm: ProcessedCourse = { ...course, students: [course.students[1]] }
    expect(computeSuggestions(calm, 3)).toEqual([])
  })
})

import { aggregateSuggestions } from './suggestionRules'

describe('aggregateSuggestions', () => {
  it('tags each course’s cards with that course', () => {
    // `course` fixture from this file has an escalation at week 3 for student 11.
    const a = { ...course, module: 'AAA', presentation: '2013J' }
    const b = { ...course, module: 'BBB', presentation: '2014J' }
    const result = aggregateSuggestions([a, b], 3)
    expect(result.length).toBeGreaterThan(0)
    expect(new Set(result.map((r) => r.module))).toEqual(new Set(['AAA', 'BBB']))
    for (const r of result) {
      expect(r.card).toHaveProperty('id')
      expect(typeof r.presentation).toBe('string')
    }
  })
  it('returns empty when no course has signals', () => {
    const calm = { ...course, students: [course.students[1]] } // student 12 is steady
    expect(aggregateSuggestions([calm], 3)).toEqual([])
  })
})
