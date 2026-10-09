/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

/** Files that are not playlist-pinned. Playlist covers are excluded before this cap. */
export const UNPINNED_IMAGE_CACHE_LIMIT = 400

/**
 * Extra ceiling for unpinned images. User playlist covers are not counted.
 * 256 MiB keeps a handful of playback-detail originals from filling the cache
 * while the count limit is still the setting the user changes.
 */
export const DEFAULT_UNPINNED_IMAGE_CACHE_BYTES = 256 * 1024 * 1024

export interface ImageCacheEntry {
  name: string
  size?: number
  /** Lower means older. Directory order is used when the caller passes plain names. */
  accessedAt?: number
}

const asEntry = (file: string | ImageCacheEntry, index: number): ImageCacheEntry => {
  if (typeof file == 'string') return { name: file, size: 0, accessedAt: index }
  return {
    name: file.name,
    size: file.size ?? 0,
    accessedAt: file.accessedAt ?? index,
  }
}

/**
 * Evict unpinned files once they exceed the count cap or the byte cap.
 * Pinned playlist thumbs stay until the user clears the image cache.
 * Oldest access time goes first. Plain names keep directory order: the front is oldest.
 */
export const selectUnpinnedEvictions = (
  fileNames: ReadonlyArray<string | ImageCacheEntry>,
  pinned: ReadonlySet<string>,
  maxUnpinned = UNPINNED_IMAGE_CACHE_LIMIT,
  maxBytes = Number.POSITIVE_INFINITY,
): string[] => {
  const unpinned: Array<ImageCacheEntry & { order: number }> = []
  fileNames.forEach((file, index) => {
    const entry = asEntry(file, index)
    if (!entry.name || entry.name.endsWith('.tmp')) return
    if (pinned.has(entry.name)) return
    unpinned.push({ ...entry, order: index })
  })
  unpinned.sort((a, b) => (a.accessedAt ?? 0) - (b.accessedAt ?? 0) || a.order - b.order)
  let count = unpinned.length
  let bytes = 0
  for (const entry of unpinned) bytes += entry.size ?? 0
  const evict: string[] = []
  for (const entry of unpinned) {
    if (count <= maxUnpinned && bytes <= maxBytes) break
    evict.push(entry.name)
    count -= 1
    bytes -= entry.size ?? 0
  }
  return evict
}
