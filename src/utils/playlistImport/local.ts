/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export interface ImportCandidate {
  id: string
  musicInfo: LX.Music.MusicInfo
  fromListName: string
  fromListIds: string[]
}

// createList uses userlist_${Date.now()}; imported/custom IDs may carry no time.
// locationUpdateTime describes reordering, so it must not stand in for creation.
export const playlistCreationTime = (id: string): number | null => {
  const match = /^userlist_(\d{13})$/.exec(id)
  return match ? Number(match[1]) : null
}

export const sortImportPlaylists = <T extends { id: string }>(lists: readonly T[], newestFirst = true): T[] =>
  lists.map((list, index) => ({ list, index, time: playlistCreationTime(list.id) }))
    .sort((a, b) => {
      if (a.time == null && b.time == null) return a.index - b.index
      if (a.time == null) return 1
      if (b.time == null) return -1
      return (newestFirst ? b.time - a.time : a.time - b.time) || a.index - b.index
    }).map(({ list }) => list)

export const buildLocalCandidates = (
  existing: readonly LX.Music.MusicInfo[],
  lists: ReadonlyArray<{ id: string, listName: string, songs: LX.Music.MusicInfo[] }>,
): ImportCandidate[] => {
  const excluded = new Set(existing.map(song => `${song.source}_${song.id}`))
  const candidates = new Map<string, ImportCandidate>()
  for (const { id, listName, songs } of lists) {
    for (const musicInfo of songs) {
      const key = `${musicInfo.source}_${musicInfo.id}`
      if (excluded.has(key)) continue
      const existing = candidates.get(key)
      if (existing) {
        if (!existing.fromListIds.includes(id)) existing.fromListIds.push(id)
      } else candidates.set(key, { id: key, musicInfo, fromListName: listName, fromListIds: [id] })
    }
  }
  return [...candidates.values()]
}

export const filterLocalCandidates = (items: readonly ImportCandidate[], list: { id: string, name: string }, search: string): ImportCandidate[] => {
  const query = search.trim().toLowerCase()
  return items.filter(item => item.fromListIds.includes(list.id) &&
    (!query || [list.name, item.musicInfo.name, item.musicInfo.singer].some(value => value?.toLowerCase().includes(query))))
}
