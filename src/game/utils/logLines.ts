import type { LogEntry } from '../types'

/** Append messages to the log, minting a stable id for each. Pure. */
export function logLines(
  log: LogEntry[],
  nextLogId: number,
  messages: string[],
): { log: LogEntry[]; nextLogId: number } {
  if (messages.length === 0) return { log, nextLogId }
  const added = messages.map((text, i) => ({ id: nextLogId + i, text }))
  return { log: [...log, ...added], nextLogId: nextLogId + messages.length }
}
