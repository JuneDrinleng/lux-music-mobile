/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export const MAX_SHARE_LINES = 6
export interface ShareLine {
  time: number
  text: string
  translation?: string
}
export interface LineSelection {
  /** Bound to a track/lyric revision so a stale sheet cannot export another song. */
  source: string
  indices: readonly number[]
}
export interface SelectionResult { selection: LineSelection, error?: 'limit' | 'invalid' | 'stale' }

const selectable = (lines: readonly ShareLine[], index: number) =>
  Number.isInteger(index) && index >= 0 && index < lines.length && !!lines[index].text.trim()

/** Long press starts a fresh sheet with that line checked. */
export const openLineSelection = (source: string, lines: readonly ShareLine[], index: number): LineSelection => ({
  source,
  indices: selectable(lines, index) ? [index] : [],
})

/** Individual toggles allow both continuous passages and multiple separate lines. */
export const toggleShareLine = (selection: LineSelection, source: string, lines: readonly ShareLine[], index: number): SelectionResult => {
  if (selection.source !== source) return { selection, error: 'stale' }
  if (!selectable(lines, index)) return { selection, error: 'invalid' }
  if (selection.indices.includes(index)) return { selection: { source, indices: selection.indices.filter(value => value !== index) } }
  if (selection.indices.length >= MAX_SHARE_LINES) return { selection, error: 'limit' }
  return { selection: { source, indices: [...selection.indices, index].sort((a, b) => a - b) } }
}

/** Atomic inclusive range selection: oversize ranges never silently truncate lyrics. */
export const selectShareRange = (selection: LineSelection, source: string, lines: readonly ShareLine[], from: number, to: number): SelectionResult => {
  if (selection.source !== source) return { selection, error: 'stale' }
  if (!selectable(lines, from) || !selectable(lines, to)) return { selection, error: 'invalid' }
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  if (end - start + 1 > MAX_SHARE_LINES) return { selection, error: 'limit' }
  const indices = Array.from({ length: end - start + 1 }, (_, i) => start + i)
  if (indices.some(index => !selectable(lines, index))) return { selection, error: 'invalid' }
  return { selection: { source, indices } }
}

export const clearShareLines = (selection: LineSelection): LineSelection => ({ ...selection, indices: [] })
export const describeSelection = ({ indices }: LineSelection) => ({
  count: indices.length,
  first: indices.length ? indices[0] + 1 : null,
  last: indices.length ? indices[indices.length - 1] + 1 : null,
  contiguous: indices.every((index, i) => i === 0 || index === indices[i - 1] + 1),
})

export const selectedShareLines = (selection: LineSelection, source: string, lines: readonly ShareLine[]): ShareLine[] => {
  if (selection.source !== source || !selection.indices.length || selection.indices.length > MAX_SHARE_LINES ||
      new Set(selection.indices).size !== selection.indices.length || selection.indices.some(index => !selectable(lines, index))) return []
  return [...selection.indices].sort((a, b) => a - b).map(index => ({ ...lines[index] }))
}
