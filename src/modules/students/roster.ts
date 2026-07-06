import type { ProcessedCourse } from '../../types/domain'

export interface RosterRow {
  id_student: number
  module: string
  presentation: string
  tier: number
  risk: number
  decayed_engagement: number
  final_result: string
}

export interface RosterFilters {
  module?: string
  presentation?: string
  tier?: number
  final_result?: string
  search?: string
}

export interface RosterSort {
  key: 'tier' | 'risk' | 'decayed_engagement' | 'id_student'
  dir: 'asc' | 'desc'
}

// Domain arrays are 0-indexed at week 1, so week W is index W - 1.
const at = <T>(arr: T[], week: number): T | undefined => arr[week - 1]

export function buildRoster(courses: ProcessedCourse[], week: number): RosterRow[] {
  const rows: RosterRow[] = []
  for (const c of courses) {
    for (const s of c.students) {
      rows.push({
        id_student: s.id_student,
        module: c.module,
        presentation: c.presentation,
        tier: at(s.tier_by_week, week) ?? 1,
        risk: at(s.risk_by_week, week) ?? 0,
        decayed_engagement: at(s.decayed_engagement, week) ?? 0,
        final_result: s.final_result,
      })
    }
  }
  return rows
}

export function filterAndSortRoster(rows: RosterRow[], filters: RosterFilters, sort: RosterSort): RosterRow[] {
  const filtered = rows.filter((r) => {
    if (filters.module && r.module !== filters.module) return false
    if (filters.presentation && r.presentation !== filters.presentation) return false
    if (filters.tier != null && r.tier !== filters.tier) return false
    if (filters.final_result && r.final_result !== filters.final_result) return false
    if (filters.search && !String(r.id_student).includes(filters.search.trim())) return false
    return true
  })
  const factor = sort.dir === 'asc' ? 1 : -1
  return [...filtered].sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    return av < bv ? -factor : av > bv ? factor : 0
  })
}
