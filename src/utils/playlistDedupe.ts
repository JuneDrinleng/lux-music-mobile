/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { artistNames } from './memories/onThisDay'

export interface DuplicateGroup { indices: number[] }

/** Exact means source + nonempty songId OR id. Across sources only: identical,
 * case-sensitive title, identical artist sets (existing artistNames splitter),
 * and identical known positive duration in seconds. No fuzzy/version matching,
 * case folding, duration tolerance, or matches on missing metadata. */
export const findPlaylistDuplicates = (songs: readonly LX.Music.MusicInfo[]): DuplicateGroup[] => {
  const parent = songs.map((_, index) => index)
  const root = (index: number): number => {
    while (parent[index] !== index) { parent[index] = parent[parent[index]]; index = parent[index] }
    return index
  }
  const join = (a: number, b: number) => {
    a = root(a); b = root(b)
    parent[Math.max(a, b)] = Math.min(a, b)
  }
  const ids = new Map<string, number>()
  const contents = new Map<string, Map<string, number>>()
  songs.forEach((song, index) => {
    for (const [kind, value] of [['id', song.id], ['songmid', song.meta.songId]]) {
      if (value == null || value === '') continue
      const key = JSON.stringify([song.source, kind, String(value)])
      const previous = ids.get(key)
      if (previous != null) join(previous, index)
      ids.set(key, index)
    }
    const parts = song.interval?.split(':').map(Number) ?? []
    const duration = parts.length >= 2 && parts.length <= 3 && parts.every(n => Number.isFinite(n) && n >= 0)
      ? parts.reduce((total, n) => total * 60 + n, 0) : 0
    const artists = artistNames(song.singer).sort()
    if (!song.name.trim() || !artists.length || duration <= 0) return
    const key = JSON.stringify([song.name, artists, duration])
    const sources = contents.get(key) ?? new Map<string, number>()
    for (const [source, previous] of sources) {
      if (source !== song.source) join(previous, index)
    }
    sources.set(song.source, index)
    contents.set(key, sources)
  })
  const groups = new Map<number, number[]>()
  songs.forEach((_, index) => {
    const first = root(index)
    const group = groups.get(first) ?? []
    group.push(index)
    groups.set(first, group)
  })
  return [...groups.values()].filter(indices => indices.length > 1).map(indices => ({ indices }))
}

/** Occurrence indices protect the first item and every unchecked duplicate. */
export const playlistDedupeSelection = (songs: readonly LX.Music.MusicInfo[], checked?: ReadonlySet<number>) => {
  const removable = findPlaylistDuplicates(songs).flatMap(group => group.indices.slice(1))
  const selected = new Set(removable.filter(index => checked == null || checked.has(index)))
  const kept = songs.filter((_, index) => !selected.has(index))
  const removed = songs.filter((_, index) => selected.has(index))
  // removeListMusics removes every occurrence of an id. Use the existing synced
  // overwrite action when that would also remove a retained occurrence.
  const keptIds = new Set(kept.map(song => String(song.id)))
  return { kept, removed, requiresOverwrite: removed.some(song => keptIds.has(String(song.id))) }
}

/** Re-read after confirmation: never apply review indices to a changed sync list. */
export const applyPlaylistDedupe = async(
  snapshot: readonly LX.Music.MusicInfo[],
  checked: ReadonlySet<number>,
  api: {
    read: () => Promise<LX.Music.MusicInfo[]>
    isCurrent: () => boolean
    remove: (ids: string[]) => Promise<void>
    overwrite: (songs: LX.Music.MusicInfo[]) => Promise<void>
  },
): Promise<boolean> => {
  const latest = await api.read()
  if (!api.isCurrent() || JSON.stringify(latest) !== JSON.stringify(snapshot)) return false
  const result = playlistDedupeSelection(latest, checked)
  if (!result.removed.length) return true
  if (result.requiresOverwrite) await api.overwrite(result.kept)
  else await api.remove([...new Set(result.removed.map(song => String(song.id)))])
  return true
}
