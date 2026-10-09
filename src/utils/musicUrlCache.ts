/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

/**
 * How long a saved playback URL may be reused before the player asks the source again.
 * Values follow the usual lifetime of each source's play link, on the short side so the
 * first play does not wait on an expired address.
 */
export const MUSIC_URL_TTL_MS = {
  /** 网易云外链常见约 20–25 分钟。 */
  wy: 20 * 60 * 1000,
  /** QQ 音乐 vkey 常见约 2 小时。 */
  tx: 2 * 60 * 60 * 1000,
  /** 酷狗播放地址常见 1–6 小时，取 2 小时。 */
  kg: 2 * 60 * 60 * 1000,
  /** 酷我防盗链参数偏短，多见 1 小时内失效。 */
  kw: 60 * 60 * 1000,
  /** 咪咕播放地址常见约 1 小时。 */
  mg: 60 * 60 * 1000,
  /** 本地歌曲借在线源时来源不固定，取较短的 30 分钟。 */
  local: 30 * 60 * 1000,
} as const

export const DEFAULT_MUSIC_URL_TTL_MS = 30 * 60 * 1000

export interface MusicUrlRecord {
  url: string
  savedAt: number
}

export const musicUrlTtlMs = (source: string) => {
  if (Object.prototype.hasOwnProperty.call(MUSIC_URL_TTL_MS, source)) {
    return MUSIC_URL_TTL_MS[source as keyof typeof MUSIC_URL_TTL_MS]
  }
  return DEFAULT_MUSIC_URL_TTL_MS
}

export const isDirectMediaUrl = (url: string) => /^(file|content):/i.test(url)

/** Legacy values are bare strings and are treated as already expired. */
export const parseMusicUrlRecord = (raw: unknown): MusicUrlRecord | null => {
  if (typeof raw == 'string') {
    const url = raw.trim()
    if (!url) return null
    return { url, savedAt: 0 }
  }
  if (!raw || typeof raw != 'object') return null
  const record = raw as { url?: unknown, savedAt?: unknown }
  if (typeof record.url != 'string' || !record.url.trim()) return null
  const savedAt = typeof record.savedAt == 'number' && Number.isFinite(record.savedAt) ? record.savedAt : 0
  return { url: record.url.trim(), savedAt }
}

export const serializeMusicUrlRecord = (url: string, savedAt: number): MusicUrlRecord => ({
  url,
  savedAt,
})

export const isMusicUrlFresh = (record: MusicUrlRecord, source: string, now: number) => {
  if (isDirectMediaUrl(record.url)) return true
  if (!record.savedAt) return false
  return now - record.savedAt < musicUrlTtlMs(source)
}

/**
 * Expired addresses are fetched again before playback.
 * A hit in the audio cache skips that refresh unless the caller is already recovering from an error.
 */
export const decideMusicUrlReuse = (input: {
  record: MusicUrlRecord | null
  source: string
  now: number
  isRefresh: boolean
  audioCached: boolean
}): 'use' | 'refresh' => {
  if (!input.record?.url) return 'refresh'
  if (isDirectMediaUrl(input.record.url)) return 'use'
  if (input.isRefresh) return 'refresh'
  if (input.audioCached) return 'use'
  return isMusicUrlFresh(input.record, input.source, input.now) ? 'use' : 'refresh'
}
