import { describe, it, expect } from 'vitest'
import { inCourseWindow, buildAgenda } from './agenda'
import { weekToDate } from '../../shared/scheduleAnchors'
import type { ScheduleEvent } from '../../types/domain'

function ev(presentation: string, week: number): ScheduleEvent {
  return { module: 'X', presentation, kind: 'lecture', title: `w${week}`, date: weekToDate(presentation, week), week, created_at: '' }
}

describe('inCourseWindow', () => {
  it('true when the event is in [week+from, week+to) of its own anchor', () => {
    expect(inCourseWindow(ev('2013J', 3), 3, 0, 1)).toBe(true)   // week-3 event, this-week window
    expect(inCourseWindow(ev('2013J', 5), 3, 0, 1)).toBe(false)  // week-5 event, not this week
    expect(inCourseWindow(ev('2013J', 5), 3, 1, 4)).toBe(true)   // week-5 event, next-4-weeks window
  })
  it('false for a presentation with no anchor', () => {
    const e: ScheduleEvent = { ...ev('2013J', 3), presentation: '9999X' }
    expect(inCourseWindow(e, 3, 0, 1)).toBe(false)
  })
})

describe('buildAgenda', () => {
  it('splits events into thisWeek and thisMonth by their own course anchor', () => {
    const events = [ev('2013J', 3), ev('2013J', 5), ev('2014J', 3)]
    const { thisWeek, thisMonth } = buildAgenda(events, 3)
    expect(thisWeek.map((e) => e.presentation).sort()).toEqual(['2013J', '2014J']) // both week-3 events, different years
    expect(thisMonth.map((e) => e.title)).toEqual(['w5'])
  })
  it('sorts each bucket ascending by date', () => {
    const events = [ev('2013J', 3), ev('2014J', 3)] // 2014 date is later
    expect(buildAgenda(events, 3).thisWeek.map((e) => e.presentation)).toEqual(['2013J', '2014J'])
  })
})
