import { describe, expect, it } from 'vitest'
import { logLines } from './logLines'
import type { LogEntry } from '../types'

const log: LogEntry[] = [{ id: 0, text: 'first' }]

describe('logLines', () => {
  it('returns the same log and id when there are no messages', () => {
    const r = logLines(log, 1, [])
    expect(r.log).toBe(log)
    expect(r.nextLogId).toBe(1)
  })

  it('appends each message with a monotonic id and advances nextLogId', () => {
    const r = logLines(log, 1, ['second', 'third'])
    expect(r.log).toEqual([
      { id: 0, text: 'first' },
      { id: 1, text: 'second' },
      { id: 2, text: 'third' },
    ])
    expect(r.nextLogId).toBe(3)
  })

  it('does not mutate the original log', () => {
    logLines(log, 1, ['x'])
    expect(log).toHaveLength(1)
  })
})
