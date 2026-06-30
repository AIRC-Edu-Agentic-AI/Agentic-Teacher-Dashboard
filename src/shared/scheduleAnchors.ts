// Per-presentation anchor start date (Monday of course week 1).
// Demo approximations for the OULAD presentation codes.
export const PRESENTATION_ANCHORS: Record<string, string> = {
  '2013B': '2013-02-04',
  '2013J': '2013-10-07',
  '2014B': '2014-02-03',
  '2014J': '2014-10-06',
}

const DAY_MS = 24 * 60 * 60 * 1000

export function weekToDate(presentation: string, week: number): string {
  const anchor = PRESENTATION_ANCHORS[presentation]
  if (!anchor) throw new Error(`No anchor date for presentation ${presentation}`)
  const start = new Date(`${anchor}T00:00:00.000Z`).getTime()
  return new Date(start + (week - 1) * 7 * DAY_MS).toISOString()
}

export function weekRange(presentation: string, week: number): { start: string; end: string } {
  const start = weekToDate(presentation, week)
  const end = new Date(new Date(start).getTime() + 7 * DAY_MS).toISOString()
  return { start, end }
}
