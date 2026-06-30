import { describe, it, expect } from 'vitest'
import { validateStudentNotification } from './studentNotificationValidation'

describe('validateStudentNotification', () => {
  const base = { student_id: 12, module: 'AAA', presentation: '2013J', title: 't', body: 'b', type: 'intervention' as const }

  it('passes a valid notification', () => {
    expect(validateStudentNotification(base)).toEqual([])
  })
  it('flags missing string fields', () => {
    expect(validateStudentNotification({ student_id: 12 })).toEqual(
      expect.arrayContaining(['Missing required field: module', 'Missing required field: title']),
    )
  })
  it('requires a numeric student_id', () => {
    expect(validateStudentNotification({ ...base, student_id: undefined })).toContain('Missing required field: student_id')
  })
  it('rejects an unknown type', () => {
    expect(validateStudentNotification({ ...base, type: 'spam' as never })).toContain('Invalid type: spam')
  })
})
