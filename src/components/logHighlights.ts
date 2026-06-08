// Splits an activity-log line into display segments, colouring only the
// meaningful spans (gold, damage taken, kills/XP/heals, level-ups, death) rather
// than the whole line, which would be noisy to read. Pure and presentation-only:
// the engine still logs plain strings; this classifies them for rendering.

/** The kinds of emphasis a log span can carry. */
export type LogTone = 'gold' | 'bad' | 'good' | 'level' | 'death'

/** A run of log text, optionally emphasised with a {@link LogTone}. */
export interface LogSegment {
  text: string
  tone?: LogTone
}

// Span patterns, highest priority first. Each is matched globally; overlapping
// matches are dropped so the first rule to claim a span wins.
const RULES: { re: RegExp; tone: LogTone }[] = [
  { re: /\d+ gold/g, tone: 'gold' }, // "10 gold"
  { re: /\b\w+ you for \d+/g, tone: 'bad' }, // "slashes you for 1"
  { re: /\+\d+ XP/g, tone: 'good' }, // "+12 XP"
  { re: /recover \d+ HP/g, tone: 'good' }, // "recover 8 HP"
  { re: /your armor holds/g, tone: 'good' },
  { re: /\bslain\b/g, tone: 'good' },
  { re: /level \d+/g, tone: 'level' }, // "reach level 3"
]

/** Break `text` into coloured/plain segments for the activity log. */
export function splitLog(text: string): LogSegment[] {
  // A death line reads as one ominous span (and pre-empts the "slain" rule).
  if (/\bcollapse\b/.test(text)) return [{ text, tone: 'death' }]

  const marks: { start: number; end: number; tone: LogTone }[] = []
  for (const { re, tone } of RULES) {
    for (const m of text.matchAll(re)) {
      const start = m.index ?? 0
      const end = start + m[0].length
      if (!marks.some((k) => start < k.end && end > k.start)) marks.push({ start, end, tone })
    }
  }
  if (marks.length === 0) return [{ text }]

  marks.sort((a, b) => a.start - b.start)
  const segments: LogSegment[] = []
  let i = 0
  for (const k of marks) {
    if (k.start > i) segments.push({ text: text.slice(i, k.start) })
    segments.push({ text: text.slice(k.start, k.end), tone: k.tone })
    i = k.end
  }
  if (i < text.length) segments.push({ text: text.slice(i) })
  return segments
}
