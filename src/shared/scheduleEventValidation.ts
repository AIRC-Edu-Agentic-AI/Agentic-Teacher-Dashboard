import type { ScheduleEvent } from '../types/domain'

const KINDS = ['class', 'lecture', 'task']

export function validateScheduleEvent(e: Partial<ScheduleEvent>): string[] {
  const errors: string[] = []
  for (const field of ['module', 'presentation', 'kind', 'title', 'date'] as const) {
    if (!e[field]) errors.push(`Missing required field: ${field}`)
  }
  if (e.kind && !KINDS.includes(e.kind)) errors.push(`Invalid kind: ${e.kind}`)
  if (e.kind === 'class') {
    if (!e.classroom) errors.push('class requires classroom')
    if (!e.class_type) errors.push('class requires class_type')
  }
  if (e.kind === 'task') {
    if (!e.source) errors.push('task requires source')
    if (!e.status) errors.push('task requires status')
  }
  return errors
}
