/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

/** Kuwo search-by-rid returns usable titles without www CSRF; www musicInfo rejects the app. */
export const kwRidMusicInfoUrl = (songmid: string) => {
  const mid = String(songmid || '').trim()
  return `http://search.kuwo.cn/r.s?rid=MUSIC_${encodeURIComponent(mid)}&ft=music&client=kt&pn=0&rn=1&rformat=json&encoding=utf8&mobi=1&vermerge=1&show_copyright_off=1&newver=1`
}

export const kwAlbumCoverUrl = (shortPath: string | null | undefined) => {
  const path = String(shortPath ?? '').trim().replace(/^\/+/, '')
  if (!path) return ''
  if (/^https?:\/\//i.test(path)) return path
  return `https://img1.kuwo.cn/star/albumcover/${path}`
}

/** Enough for Kuwo search fields (`&nbsp;`, `&amp;`); avoids pulling `he` into unit tests. */
const cleanText = (value: unknown) => {
  if (value == null) return ''
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\u00a0/g, ' ')
    .trim()
}

export interface KwParsedMusicInfo {
  name: string
  artist: string
  duration: number
  album: string
  albumid: string
  pic: string
  songmid: string
}

/** Reject the dead www endpoint body so callers never treat it as a song. */
export const isIllegalKwMusicInfoBody = (body: unknown) => {
  if (!body || typeof body != 'object') return false
  const row = body as { success?: unknown, message?: unknown, code?: unknown }
  if (row.success === false) return true
  if (typeof row.message == 'string' && /illegal/i.test(row.message)) return true
  return false
}

/**
 * Normalize either search.kuwo.cn abslist rows or a legacy www musicInfo `data` object
 * into the shape `fetchKw` / `handleMusicInfo` already expect.
 */
export const parseKwSearchMusicInfo = (body: unknown, expectedMid?: string): KwParsedMusicInfo | null => {
  if (isIllegalKwMusicInfoBody(body)) return null
  if (!body || typeof body != 'object') return null

  const root = body as {
    abslist?: unknown
    data?: unknown
    name?: unknown
    artist?: unknown
    duration?: unknown
    album?: unknown
    albumid?: unknown
    albumId?: unknown
    pic?: unknown
    pic120?: unknown
    SONGNAME?: unknown
    ARTIST?: unknown
    DURATION?: unknown
    ALBUM?: unknown
    ALBUMID?: unknown
    MUSICRID?: unknown
    web_albumpic_short?: unknown
    hts_MVPIC?: unknown
  }

  let row: Record<string, unknown> | null = null
  if (Array.isArray(root.abslist) && root.abslist[0] && typeof root.abslist[0] == 'object') {
    row = root.abslist[0] as Record<string, unknown>
  } else if (root.data && typeof root.data == 'object') {
    row = root.data as Record<string, unknown>
  } else if (root.name || root.SONGNAME) {
    row = root as Record<string, unknown>
  }
  if (!row) return null

  const name = cleanText(row.SONGNAME ?? row.name)
  if (!name) return null

  const ridRaw = cleanText(row.MUSICRID ?? row.rid ?? expectedMid ?? '')
  const stripped = ridRaw.replace(/^(MUSIC_|kw_)+/i, '')
  const songmid = stripped || String(expectedMid ?? '').trim()
  if (expectedMid) {
    const want = String(expectedMid).replace(/^(MUSIC_|kw_)+/i, '')
    if (songmid && want && songmid != want) return null
  }

  const durationRaw = Number(row.DURATION ?? row.duration ?? 0)
  const duration = Number.isFinite(durationRaw)
    ? (durationRaw > 10000 ? durationRaw / 1000 : durationRaw)
    : 0

  const pic = kwAlbumCoverUrl(
    cleanText(row.pic ?? row.pic120 ?? row.web_albumpic_short ?? row.hts_MVPIC ?? ''),
  )

  return {
    name,
    artist: cleanText(row.ARTIST ?? row.artist),
    duration,
    album: cleanText(row.ALBUM ?? row.album),
    albumid: cleanText(row.ALBUMID ?? row.albumid ?? row.albumId),
    pic,
    songmid,
  }
}
