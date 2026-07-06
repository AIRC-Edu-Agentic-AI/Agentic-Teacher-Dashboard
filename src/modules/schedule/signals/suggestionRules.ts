import type { ProcessedCourse, StudentProfile } from '../../../types/domain'

export interface SuggestionCard {
  id: string
  kind: 'tier-escalation' | 'engagement-drop' | 'assessment-risk'
  title: string
  detail: string
  defaultTask: { title: string; student_id: number | null }
}

// Domain arrays are 0-indexed at week 1, so week W is index W - 1.
const at = <T>(arr: T[], week: number): T | undefined => arr[week - 1]

const MAX_ENGAGEMENT_CARDS = 3
const ENGAGEMENT_DROP_RATIO = 0.5 // current < 50% of trailing average

function tierEscalation(course: ProcessedCourse, week: number): SuggestionCard[] {
  if (week < 2) return []
  const escalated = course.students.filter((s) => {
    const prev = at(s.tier_by_week, week - 1)
    const cur = at(s.tier_by_week, week)
    return prev != null && cur != null && cur > prev
  })
  if (escalated.length === 0) return []
  return [{
    id: `tier-escalation-w${week}`,
    kind: 'tier-escalation',
    title: 'Risk tier escalations this week',
    detail: `${escalated.length} student${escalated.length === 1 ? '' : 's'} escalated to a higher risk tier.`,
    defaultTask: { title: `Review ${escalated.length} tier escalation(s) (week ${week})`, student_id: null },
  }]
}

function engagementDrop(course: ProcessedCourse, week: number): SuggestionCard[] {
  if (week < 2) return []
  const p75 = at(course.cohort_p75_decayed, week) ?? Infinity
  const dropped: { s: StudentProfile; cur: number }[] = []
  for (const s of course.students) {
    const cur = at(s.decayed_engagement, week)
    if (cur == null) continue
    const history = s.decayed_engagement.slice(0, week - 1).filter((v): v is number => v != null)
    if (history.length === 0) continue
    const avg = history.reduce((a, b) => a + b, 0) / history.length
    if (cur < avg * ENGAGEMENT_DROP_RATIO && cur < p75) dropped.push({ s, cur })
  }
  dropped.sort((a, b) => a.cur - b.cur)
  return dropped.slice(0, MAX_ENGAGEMENT_CARDS).map(({ s }) => ({
    id: `engagement-drop-${s.id_student}-w${week}`,
    kind: 'engagement-drop' as const,
    title: `Student #${s.id_student} engagement dropped`,
    detail: `Engagement fell sharply and is below the cohort's 75th percentile.`,
    defaultTask: { title: `Check in with student #${s.id_student}`, student_id: s.id_student },
  }))
}

function assessmentRisk(course: ProcessedCourse, week: number): SuggestionCard[] {
  // Day offset of the current week (course day numbering), 7 days per week.
  const weekDay = (week - 1) * 7
  const cards: SuggestionCard[] = []
  const seen = new Set<number>()
  for (const s of course.students) {
    for (const a of s.assessments) {
      if (a.date_due == null || seen.has(a.id_assessment)) continue
      const daysUntil = a.date_due - weekDay
      if (daysUntil < 0 || daysUntil > 7) continue
      seen.add(a.id_assessment)
      const notSubmitted = course.students.filter((st) =>
        st.assessments.some((x) => x.id_assessment === a.id_assessment && x.date_submitted == null)).length
      if (notSubmitted === 0) continue
      cards.push({
        id: `assessment-risk-${a.id_assessment}-w${week}`,
        kind: 'assessment-risk',
        title: `Assessment due soon`,
        detail: `Assessment ${a.id_assessment} is due within ${daysUntil} day(s); ${notSubmitted} not submitted.`,
        defaultTask: { title: `Chase ${notSubmitted} non-submitters for assessment ${a.id_assessment}`, student_id: null },
      })
    }
  }
  return cards
}

export function computeSuggestions(course: ProcessedCourse, week: number): SuggestionCard[] {
  return [
    ...tierEscalation(course, week),
    ...engagementDrop(course, week),
    ...assessmentRisk(course, week),
  ]
}

export interface CourseSuggestion {
  card: SuggestionCard
  module: string
  presentation: string
}

export function aggregateSuggestions(courses: ProcessedCourse[], week: number): CourseSuggestion[] {
  const out: CourseSuggestion[] = []
  for (const course of courses) {
    for (const card of computeSuggestions(course, week)) {
      out.push({ card, module: course.module, presentation: course.presentation })
    }
  }
  return out
}
