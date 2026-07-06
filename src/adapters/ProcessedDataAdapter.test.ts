import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProcessedDataAdapter } from './ProcessedDataAdapter'

beforeEach(() => { vi.restoreAllMocks() })

describe('ProcessedDataAdapter.getAllCourses', () => {
  it('returns one processed course per index entry', async () => {
    const index = { courses: [
      { module: 'AAA', presentation: '2013J', num_weeks: 39, student_count: 1 },
      { module: 'BBB', presentation: '2013J', num_weeks: 39, student_count: 1 },
    ] }
    const course = (module: string) => ({ module, presentation: '2013J', num_weeks: 39, students: [], cohort_p75_decayed: [] })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('index.json')) return { ok: true, json: async () => index } as unknown as Response
      const mod = url.includes('AAA') ? 'AAA' : 'BBB'
      return { ok: true, json: async () => course(mod) } as unknown as Response
    }))
    const all = await new ProcessedDataAdapter().getAllCourses()
    expect(all).toHaveLength(2)
    expect(all.map((c) => c.module).sort()).toEqual(['AAA', 'BBB'])
  })
})
