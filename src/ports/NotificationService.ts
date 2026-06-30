import type { StudentNotification } from '../types/domain'

export interface NotificationService {
  send(n: Omit<StudentNotification, '_id' | 'created_at'>): Promise<StudentNotification>
  list(module: string, presentation: string, studentId?: number): Promise<StudentNotification[]>
}
