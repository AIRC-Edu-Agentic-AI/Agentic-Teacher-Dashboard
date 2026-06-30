import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ApiNotificationAdapter } from './ApiNotificationAdapter'

const adapter = new ApiNotificationAdapter()

beforeEach(() => { vi.restoreAllMocks() })

describe('ApiNotificationAdapter', () => {
  it('posts a notification', async () => {
    const saved = { _id: '1', student_id: 12, module: 'AAA', presentation: '2013J', title: 't', body: 'b', type: 'intervention', created_at: 'now' }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => saved }))
    const result = await adapter.send({ student_id: 12, module: 'AAA', presentation: '2013J', title: 't', body: 'b', type: 'intervention' })
    expect(result).toEqual(saved)
    expect((fetch as any).mock.calls[0][0]).toContain('/student-notifications')
  })

  it('throws with server detail on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'Missing required field: title' }) }))
    await expect(adapter.send({ student_id: 12, module: 'AAA', presentation: '2013J', title: '', body: 'b', type: 'intervention' }))
      .rejects.toThrow(/400: Missing required field: title/)
  })
})
