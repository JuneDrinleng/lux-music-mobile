/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

/** Files that are not playlist-pinned. Playlist covers are excluded before this cap. */
export const UNPINNED_IMAGE_CACHE_LIMIT = 400

/**
 * Evict only unpinned files once they exceed the cap.
 * Pinned playlist thumbs stay until the user clears the image cache.
 * Order is the directory listing: drop the front, keep the tail.
 */
export const selectUnpinnedEvictions = (
  fileNames: readonly string[],
  pinned: ReadonlySet<string>,
  maxUnpinned = UNPINNED_IMAGE_CACHE_LIMIT,
): string[] => {
  const unpinned: string[] = []
  for (const name of fileNames) {
    if (!name || name.endsWith('.tmp')) continue
    if (pinned.has(name)) continue
    unpinned.push(name)
  }
  if (unpinned.length <= maxUnpinned) return []
  return unpinned.slice(0, unpinned.length - maxUnpinned)
}
