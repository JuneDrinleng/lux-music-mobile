/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { isCached } from '@/plugins/player/utils'
import { readMusicUrlRecord } from '@/utils/data'
import { decideMusicUrlReuse, isMusicUrlFresh } from '@/utils/musicUrlCache'

/**
 * Return a saved playback URL when it is still fresh, or when the audio itself is already cached.
 * With `serverResolved` (Lux mode) the URL is reused only before the server's `expiresAt`.
 */
export const readReusableMusicUrl = async(
  musicInfo: LX.Music.MusicInfo,
  quality: LX.Quality,
  isRefresh: boolean,
  serverResolved = false,
): Promise<string | null> => {
  const record = await readMusicUrlRecord(musicInfo, quality)
  if (!record) return null
  const now = Date.now()
  let audioCached = false
  if (!serverResolved && !isRefresh && !isMusicUrlFresh(record, musicInfo.source, now)) {
    audioCached = await isCached(record.url, musicInfo).catch(() => false)
  }
  return decideMusicUrlReuse({
    record,
    source: musicInfo.source,
    now,
    isRefresh,
    audioCached,
    serverResolved,
  }) == 'use' ? record.url : null
}
