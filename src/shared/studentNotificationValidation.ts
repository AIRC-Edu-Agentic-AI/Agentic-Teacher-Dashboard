import type { StudentNotification } from '../types/domain'

const TYPES = ['intervention', 'encouragement', 'reminder', 'general']

export function validateStudentNotification(n: Partial<StudentNotification>): string[] {
  const errors: string[] = []
  if (typeof n.student_id !== 'number') errors.push('Missing required field: student_id')
  for (const field of ['module', 'presentation', 'title', 'body', 'type'] as const) {
    if (!n[field]) errors.push(`Missing required field: ${field}`)
  }
  if (n.type && !TYPES.includes(n.type)) errors.push(`Invalid type: ${n.type}`)
  return errors
}
