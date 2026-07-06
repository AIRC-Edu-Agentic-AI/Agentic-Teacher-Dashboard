import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiScheduleAdapter } from './ApiScheduleAdapter'

const adapter = new ApiScheduleAdapter()

beforeEach(() => { vi.restoreAllMocks() })

describe('ApiScheduleAdapter', () => {
  it('lists events for a course', async () => {
    const events = [{ _id: '1', module: 'AAA', presentation: '2013J', kind: 'class' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => events }))
    const result = await adapter.list('AAA', '2013J')
    expect(result).toEqual(events)
    expect((fetch as any).mock.calls[0][0]).toContain('/schedule-events?module=AAA&presentation=2013J')
  })

  it('throws with server detail on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400, json: async () => ({ error: 'task requires status' }),
    }))
    await expect(adapter.create({ module: 'AAA', presentation: '2013J', kind: 'task', title: 't', date: 'd', week: null } as any))
      .rejects.toThrow(/400: task requires status/)
  })

  it('listAll fetches all events with no query params', async () => {
    const events = [{ _id: '1', module: 'AAA', presentation: '2013J', kind: 'class' }]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => events }))
    const result = await adapter.listAll()
    expect(result).toEqual(events)
    const url = (fetch as any).mock.calls[0][0] as string
    expect(url).toMatch(/\/schedule-events$/)
  })
})
