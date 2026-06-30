import type { ScheduleEvent, ScheduleEventKind } from '../types/domain'
import type { ScheduleService } from '../ports/ScheduleService'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.error ?? '' } catch { /* non-JSON body */ }
    throw new Error(`Schedule API ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  return res.json() as Promise<T>
}

export class ApiScheduleAdapter implements ScheduleService {
  async list(module: string, presentation: string, kind?: ScheduleEventKind): Promise<ScheduleEvent[]> {
    const params = new URLSearchParams({ module, presentation })
    if (kind) params.set('kind', kind)
    return handle<ScheduleEvent[]>(await fetch(`${API_BASE}/schedule-events?${params.toString()}`))
  }

  async create(event: Omit<ScheduleEvent, '_id' | 'created_at'>): Promise<ScheduleEvent> {
    return handle<ScheduleEvent>(await fetch(`${API_BASE}/schedule-events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    }))
  }

  async update(id: string, patch: Partial<ScheduleEvent>): Promise<ScheduleEvent> {
    return handle<ScheduleEvent>(await fetch(`${API_BASE}/schedule-events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }))
  }

  async remove(id: string): Promise<void> {
    await handle<{ deleted: number }>(await fetch(`${API_BASE}/schedule-events/${id}`, { method: 'DELETE' }))
  }
}
