import { describe, it, expect } from 'vitest'
import { validateScheduleEvent, validateScheduleEventPatch } from './scheduleEventValidation'

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

describe('validateScheduleEventPatch', () => {
  it('allows a partial update that only touches optional fields', () => {
    expect(validateScheduleEventPatch({ status: 'done' })).toEqual([])
    expect(validateScheduleEventPatch({ date: '2013-10-07T00:00:00.000Z' })).toEqual([])
    expect(validateScheduleEventPatch({ classroom: '204' })).toEqual([])
  })
  it('rejects a present core field that is falsy', () => {
    expect(validateScheduleEventPatch({ title: '' })).toContain('Missing required field: title')
    expect(validateScheduleEventPatch({ module: '' })).toContain('Missing required field: module')
  })
  it('rejects an invalid kind', () => {
    expect(validateScheduleEventPatch({ kind: 'bogus' as never })).toContain('Invalid kind: bogus')
  })
  it('does not flag core fields that are absent from the patch', () => {
    expect(validateScheduleEventPatch({ status: 'done' })).not.toContain('Missing required field: kind')
  })
})
