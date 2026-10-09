/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

/** 试听列表（LIST_IDS.DEFAULT）最多保留这么多首。 */
export const LISTEN_LIST_LIMIT = 50

/**
 * Ids to drop so the listen list stays within the cap.
 * Songs do not store an insert time. "最早加入" follows the add position:
 * `top` inserts at the front, so the tail is oldest; `bottom` inserts at the end, so the head is oldest.
 */
export const selectOldestListenIds = (
  songs: ReadonlyArray<{ id: string }>,
  addLocation: string,
  limit = LISTEN_LIST_LIMIT,
): string[] => {
  if (songs.length <= limit) return []
  const extra = songs.length - limit
  const oldest = addLocation == 'bottom' ? songs.slice(0, extra) : songs.slice(-extra)
  const ids: string[] = []
  const seen = new Set<string>()
  for (const song of oldest) {
    if (!song.id || seen.has(song.id)) continue
    seen.add(song.id)
    ids.push(song.id)
  }
  return ids
}
