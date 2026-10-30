/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { tranditionalize } from '../simplify-chinese-main'
import { durationSeconds, type ImportTrack } from './parser'

export type MatchStatus = 'matched' | 'uncertain' | 'unmatched'
export interface MatchSong { name: string, singer: string, interval?: string | null, meta?: { albumName?: string } }
export const normalize = (text: string) => tranditionalize(text.normalize('NFKC')).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const titleParts = (text: string) => {
  const versions = [...text.matchAll(/live|remix|acoustic|instrumental|伴奏|现场|現場|翻唱|cover/gi)].map(match => normalize(match[0]).replace('現場', 'live'))
  return {
    base: normalize(text.replace(/[（([].*?[）)\]]/g, '').replace(/\b(?:feat\.?|ft\.?)\s+.*$/i, '').replace(/\b(?:live|remix|acoustic|instrumental|version)\b/gi, '').replace(/(?:现场|現場|伴奏|翻唱)(?:版)?/g, '')),
    versions: [...new Set(versions)].sort((a, b) => a.localeCompare(b)).join(','),
  }
}
/** Bounded edit distance; untrusted very long fields cannot make scoring quadratic without limit. */
const similarity = (a: string, b: string): number => {
  a = a.slice(0, 160); b = b.slice(0, 160)
  if (!a || !b) return 0
  if (a === b) return 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const next = [i]
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = next
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length)
}
const artistKey = (text: string) => text.replace(/\b(?:feat\.?|ft\.?)\s*/gi, '&').split(/[、/&;,，]|\s+(?:and|x)\s+/i).map(normalize).filter(Boolean).sort((a, b) => a.localeCompare(b)).join('|')
const scoreOrder = (track: ImportTrack, song: MatchSong): number => {
  const a = titleParts(track.title); const b = titleParts(song.name)
  const title = similarity(a.base, b.base)
  const artist = track.artist ? similarity(artistKey(track.artist), artistKey(song.singer)) : 0.5
  let score = title * 0.72 + artist * 0.28
  if (a.versions !== b.versions) score -= 0.22
  const duration = durationSeconds(song.interval)
  if (track.duration && duration) score -= Math.min(0.25, Math.max(0, Math.abs(track.duration - duration) - 3) / 100)
  if (track.album && song.meta?.albumName) score -= (1 - similarity(normalize(track.album), normalize(song.meta.albumName))) * 0.04
  if (title < 0.5) score = Math.min(score, 0.49)
  return Math.round(Math.max(0, Math.min(1, score)) * 100)
}
export const scoreTrack = (track: ImportTrack, song: MatchSong): number => Math.max(
  scoreOrder(track, song),
  track.reversible && track.artist ? scoreOrder({ ...track, title: track.artist, artist: track.title }, song) : 0,
)
export const matchStatus = (score: number, runnerUp?: number): MatchStatus => score < 60 ? 'unmatched' : score >= 90 && (runnerUp == null || score - runnerUp >= 5) ? 'matched' : 'uncertain'
