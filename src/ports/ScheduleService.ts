import type { ScheduleEvent, ScheduleEventKind } from '../types/domain'

export interface ScheduleService {
  list(module: string, presentation: string, kind?: ScheduleEventKind): Promise<ScheduleEvent[]>
  listAll(): Promise<ScheduleEvent[]>
  create(event: Omit<ScheduleEvent, '_id' | 'created_at'>): Promise<ScheduleEvent>
  update(id: string, patch: Partial<ScheduleEvent>): Promise<ScheduleEvent>
  remove(id: string): Promise<void>
}
