import type { StudentNotification } from '../types/domain'
import type { NotificationService } from '../ports/NotificationService'

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000/api'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json())?.error ?? '' } catch { /* non-JSON body */ }
    throw new Error(`Notification API ${res.status}${detail ? `: ${detail}` : ''}`)
  }
  return res.json() as Promise<T>
}

export class ApiNotificationAdapter implements NotificationService {
  async send(n: Omit<StudentNotification, '_id' | 'created_at'>): Promise<StudentNotification> {
    return handle<StudentNotification>(await fetch(`${API_BASE}/student-notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(n),
    }))
  }

  async list(module: string, presentation: string, studentId?: number): Promise<StudentNotification[]> {
    const params = new URLSearchParams({ module, presentation })
    if (studentId != null) params.set('student_id', String(studentId))
    return handle<StudentNotification[]>(await fetch(`${API_BASE}/student-notifications?${params.toString()}`))
  }
}
