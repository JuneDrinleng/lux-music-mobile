/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export interface SongIdentity {
  source: string
  id: string | number
}

export interface SongRowKeyStore {
  cache: WeakMap<object, string>
  ordinals: Map<string, number>
}

export const createSongRowKeyStore = (): SongRowKeyStore => ({
  cache: new WeakMap(),
  ordinals: new Map(),
})

/**
 * Stable row identity for a song object.
 * Distinct objects that share source+id get a suffix the first time they are seen.
 * The same object keeps that key after a reorder, so FlatList does not remount the row.
 * If one object reference is inserted twice, later copies get @n so keys stay unique.
 */
export const stableSongRowKey = (
  song: SongIdentity,
  index: number,
  list: readonly SongIdentity[] | null | undefined,
  store: SongRowKeyStore,
): string => {
  let key = store.cache.get(song)
  if (!key) {
    const base = `${song.source}_${song.id}`
    const seen = store.ordinals.get(base) ?? 0
    store.ordinals.set(base, seen + 1)
    key = seen == 0 ? base : `${base}#${seen}`
    store.cache.set(song, key)
  }
  if (!list || index <= 0) return key
  let repeatsBefore = 0
  const end = Math.min(index, list.length)
  for (let i = 0; i < end; i++) {
    if (list[i] === song) repeatsBefore += 1
  }
  return repeatsBefore == 0 ? key : `${key}@${repeatsBefore}`
}
