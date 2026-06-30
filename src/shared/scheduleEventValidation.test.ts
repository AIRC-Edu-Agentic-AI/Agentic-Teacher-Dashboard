import { describe, it, expect } from 'vitest'
import { validateScheduleEvent } from './scheduleEventValidation'

describe('validateScheduleEvent', () => {
  const base = { module: 'AAA', presentation: '2013J', title: 'x', date: '2013-10-07T00:00:00.000Z' }

  it('passes a valid class', () => {
    expect(validateScheduleEvent({ ...base, kind: 'class', classroom: '204', class_type: 'Regular' })).toEqual([])
  })
  it('flags missing core fields', () => {
    expect(validateScheduleEvent({ kind: 'lecture' })).toEqual(
      expect.arrayContaining(['Missing required field: module', 'Missing required field: title']),
    )
  })
  it('requires classroom and class_type for a class', () => {
    const errs = validateScheduleEvent({ ...base, kind: 'class' })
    expect(errs).toContain('class requires classroom')
    expect(errs).toContain('class requires class_type')
  })
  it('requires source and status for a task', () => {
    const errs = validateScheduleEvent({ ...base, kind: 'task' })
    expect(errs).toContain('task requires source')
    expect(errs).toContain('task requires status')
  })
  it('rejects an unknown kind', () => {
    expect(validateScheduleEvent({ ...base, kind: 'party' as never })).toContain('Invalid kind: party')
  })
})
