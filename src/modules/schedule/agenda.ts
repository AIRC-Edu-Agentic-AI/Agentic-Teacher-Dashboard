import type { ScheduleEvent } from '../../types/domain'
import { PRESENTATION_ANCHORS, weekToDate } from '../../shared/scheduleAnchors'

export interface AgendaBuckets {
  thisWeek: ScheduleEvent[]
  thisMonth: ScheduleEvent[]
}

/** True if event e falls in [week+fromWeek, week+toWeek) of ITS OWN course anchor. */
export function inCourseWindow(e: ScheduleEvent, week: number, fromWeek: number, toWeek: number): boolean {
  if (!PRESENTATION_ANCHORS[e.presentation]) return false
  const t = new Date(e.date).getTime()
  const start = new Date(weekToDate(e.presentation, week + fromWeek)).getTime()
  const end = new Date(weekToDate(e.presentation, week + toWeek)).getTime()
  return t >= start && t < end
}

const byDate = (a: ScheduleEvent, b: ScheduleEvent) => new Date(a.date).getTime() - new Date(b.date).getTime()

export function buildAgenda(events: ScheduleEvent[], week: number): AgendaBuckets {
  return {
    thisWeek: events.filter((e) => inCourseWindow(e, week, 0, 1)).sort(byDate),
    thisMonth: events.filter((e) => inCourseWindow(e, week, 1, 4)).sort(byDate),
  }
}
