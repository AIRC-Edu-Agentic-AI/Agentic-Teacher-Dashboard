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

const CORE_FIELDS = ['module', 'presentation', 'kind', 'title', 'date'] as const

/**
 * Validates a partial update (PATCH) to a schedule event. Unlike
 * validateScheduleEvent (which checks a full, about-to-be-created event),
 * this only checks fields that are actually present in the patch — optional
 * fields (status, classroom, etc.) may be omitted entirely.
 */
export function validateScheduleEventPatch(patch: Partial<ScheduleEvent>): string[] {
  const errors: string[] = []
  for (const field of CORE_FIELDS) {
    if (field in patch && !patch[field]) errors.push(`Missing required field: ${field}`)
  }
  if ('kind' in patch && patch.kind && !KINDS.includes(patch.kind)) {
    errors.push(`Invalid kind: ${patch.kind}`)
  }
  return errors
}
