/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { type MatchRow, type SearchSong } from './matcher'
import { matchStatus, normalize } from './score'
import { durationSeconds } from './parser'
export interface ReviewRow<T> extends MatchRow<T> { choice: number, selected: boolean, skipped?: boolean }
export const reviewRows = <T>(rows: Array<MatchRow<T>>): Array<ReviewRow<T>> => rows.map(row => ({ ...row, choice: 0, selected: row.status !== 'unmatched' && row.candidates.length > 0 }))
const keys = (song: SearchSong) => {
  const result = [`${song.source}:${song.id}`]
  const duration = durationSeconds(song.interval)
  if (duration && song.name && song.singer) result.push(`recording:${normalize(song.name)}:${normalize(song.singer)}:${duration}`)
  return result
}
/** Re-run against the latest list immediately before writing, including intra-import duplicates. */
export const selectedImportSongs = <T extends SearchSong>(rows: Array<ReviewRow<T>>, existing: readonly SearchSong[], skipExisting: boolean): T[] => {
  const seen = new Set(skipExisting ? existing.flatMap(keys) : [])
  const selected: T[] = []
  for (const row of rows) {
    const song = row.selected ? row.candidates[row.choice]?.song : undefined
    if (!song) continue
    const identity = keys(song)
    if (skipExisting && identity.some(key => seen.has(key))) continue
    selected.push(song)
    for (const key of identity) seen.add(key)
  }
  return selected
}

/** Keep an exhausted candidate list stable so the caller can open manual search. */
export const nextReviewCandidate = <T>(row: ReviewRow<T>): ReviewRow<T> => {
  const choice = row.choice + 1
  if (!row.candidates[choice]) return row
  return { ...row, choice, selected: true, skipped: false, status: matchStatus(row.candidates[choice].score) }
}
export const chooseReviewSong = <T>(row: ReviewRow<T>, song: T, score: number): ReviewRow<T> => ({
  ...row, candidates: [{ song, score }, ...row.candidates], choice: 0, status: 'matched', selected: true, skipped: false,
})
export const toggleReviewSkipped = <T>(row: ReviewRow<T>): ReviewRow<T> => ({ ...row, skipped: !row.skipped, selected: false })
