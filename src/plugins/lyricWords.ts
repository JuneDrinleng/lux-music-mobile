/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Source SDKs (tx/wy/kg/kw/mg) normalize word timing to LX's relative <start,duration>. */
export interface WordSpan { text: string, startMs: number, endMs: number }
interface TimedLine { time: number, text: string }

// Match lrc-file-parser's millisecond labels, including repeated timestamps.
export const timedText = (lyric: string): TimedLine[] => {
  const lines: TimedLine[] = []
  for (const raw of lyric.split(/\r\n|\n|\r/)) {
    const tags = raw.trim().match(/^(?:\[[\d:.]+\])+/)?.[0]
    if (!tags) continue
    const text = raw.trim().slice(tags.length).trim()
    for (const tag of tags.matchAll(/\[([\d:]+)(?:\.(\d+))?\]/g)) {
      const parts = tag[1].split(':').map(Number)
      const seconds = parts.reduce((total, part) => total * 60 + part, 0)
      lines.push({ time: seconds * 1000 + Number(tag[2] ?? 0), text })
    }
  }
  return lines
}

export const parseWordLyrics = (lyric: string): Map<number, WordSpan[]> => {
  const result = new Map<number, WordSpan[]>()
  for (const line of timedText(lyric)) {
    const tags = [...line.text.matchAll(/<(-?\d+),(-?\d+)(?:,-?\d+)?>/g)]
    if (!tags.length || tags[0].index !== 0) continue
    const words = tags.map((tag, index) => ({
      text: line.text.slice(tag.index + tag[0].length, tags[index + 1]?.index ?? line.text.length),
      startMs: line.time + Number(tag[1]),
      endMs: line.time + Number(tag[1]) + Number(tag[2]),
    }))
    if (words.some((word, index) => !Number.isFinite(word.startMs) || !Number.isFinite(word.endMs) || word.endMs < word.startMs || (index > 0 && word.startMs < words[index - 1].startMs))) continue
    result.set(line.time, words)
  }
  return result
}

export const wordFill = (word: WordSpan, positionMs: number): number => {
  if (!Number.isFinite(positionMs) || positionMs < word.startMs) return 0
  if (word.endMs <= word.startMs) return 1
  return Math.min(1, Math.max(0, (positionMs - word.startMs) / (word.endMs - word.startMs)))
}

export const matchingWords = (line: TimedLine, words?: WordSpan[]): WordSpan[] | undefined =>
  words?.length && words.map(word => word.text).join('') === line.text ? words : undefined

export const toggleLyricExtra = (shown: boolean, available: boolean): boolean => available ? !shown : shown
