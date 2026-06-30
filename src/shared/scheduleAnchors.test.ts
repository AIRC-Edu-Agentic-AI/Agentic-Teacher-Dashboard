import { describe, it, expect } from 'vitest'
import { weekToDate, weekRange } from './scheduleAnchors'

describe('weekToDate', () => {
  it('returns the anchor date for week 1', () => {
    expect(weekToDate('2013J', 1)).toBe('2013-10-07T00:00:00.000Z')
  })
  it('adds 7 days per week', () => {
    expect(weekToDate('2013J', 2)).toBe('2013-10-14T00:00:00.000Z')
    expect(weekToDate('2014J', 3)).toBe('2014-10-20T00:00:00.000Z')
  })
  it('throws for an unknown presentation', () => {
    expect(() => weekToDate('9999X', 1)).toThrow(/anchor/i)
  })
})

describe('weekRange', () => {
  it('spans Monday to the next Monday', () => {
    expect(weekRange('2013J', 1)).toEqual({
      start: '2013-10-07T00:00:00.000Z',
      end: '2013-10-14T00:00:00.000Z',
    })
  })
})
