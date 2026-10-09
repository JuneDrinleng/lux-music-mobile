/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { storageDataPrefix } from '@/config/constant'
import { getData, saveData } from '@/plugins/storage'
import { httpFetch } from '@/utils/request'
import kgSinger from '@/utils/musicSdk/kg/singer'
import txMusicSearch from '@/utils/musicSdk/tx/musicSearch'
import { eapiRequest } from '@/utils/musicSdk/wy/utils'

const POSITIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000
const NEGATIVE_TTL_MS = 24 * 60 * 60 * 1000

interface AvatarCacheEntry {
  url: string | null
  expiresAt: number
}

const memory = new Map<string, AvatarCacheEntry>()
const pending = new Map<string, Promise<string | null>>()
let persistTimer: ReturnType<typeof setTimeout> | null = null
let loaded = false

export const normalizeArtistName = (name: string): string => name.trim().toLowerCase().replace(/\s+/g, '')

export const artistNamesMatch = (query: string, candidate: string): boolean => {
  const left = normalizeArtistName(query)
  const right = normalizeArtistName(candidate)
  return !!left && left == right
}

const httpUrl = (value: unknown): string | null => {
  if (typeof value != 'string') return null
  const url = value.trim()
  if (!/^https?:\/\//i.test(url)) return null
  return url
}

const remember = (name: string, url: string | null) => {
  memory.set(normalizeArtistName(name), {
    url,
    expiresAt: Date.now() + (url ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
  })
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistTimer = null
    const payload: Record<string, AvatarCacheEntry> = {}
    for (const [key, entry] of memory) payload[key] = entry
    void saveData(storageDataPrefix.playHistoryAvatars, payload)
  }, 500)
}

const readCache = (name: string): string | null | undefined => {
  const entry = memory.get(normalizeArtistName(name))
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    memory.delete(normalizeArtistName(name))
    return undefined
  }
  return entry.url
}

const ensureLoaded = async() => {
  if (loaded) return
  loaded = true
  const stored = await getData<Record<string, AvatarCacheEntry>>(storageDataPrefix.playHistoryAvatars)
  if (!stored || typeof stored != 'object') return
  const now = Date.now()
  for (const [key, entry] of Object.entries(stored)) {
    if (!entry || typeof entry.expiresAt != 'number' || entry.expiresAt <= now) continue
    if (entry.url != null && !httpUrl(entry.url)) continue
    memory.set(key, { url: entry.url ?? null, expiresAt: entry.expiresAt })
  }
}

const firstMatch = (name: string, candidates: Array<{ name?: unknown, url?: unknown }>): string | null => {
  for (const candidate of candidates) {
    if (typeof candidate.name != 'string' || !artistNamesMatch(name, candidate.name)) continue
    const url = httpUrl(candidate.url)
    if (url) return url
  }
  return null
}

const fromKugou = async(name: string): Promise<string | null> => {
  const request = httpFetch(`http://mobilecdn.kugou.com/api/v3/search/singer?format=json&keyword=${encodeURIComponent(name)}&page=1&pagesize=8&showtype=1`)
  const { body, statusCode } = await request.promise
  if (statusCode != 200 || !body || typeof body != 'object') return null
  const payload = body as { data?: { info?: unknown, lists?: unknown } }
  const rawInfo = Array.isArray(payload.data?.info) ? payload.data.info : payload.data?.lists
  if (!Array.isArray(rawInfo)) return null
  for (const item of rawInfo as Array<Record<string, unknown>>) {
    const singerName = item.singername ?? item.author_name ?? item.name
    const singerId = item.singerid ?? item.author_id ?? item.id
    if (typeof singerName != 'string' || !artistNamesMatch(name, singerName)) continue
    const imgurl = typeof item.imgurl == 'string' ? item.imgurl.replace('{size}', '480') : item.avatar
    const direct = httpUrl(imgurl)
    if (direct) return direct
    if (singerId == null || (typeof singerId != 'string' && typeof singerId != 'number')) continue
    const detail = await kgSinger.getSingerInfo(singerId) as { info?: { name?: unknown, img?: unknown } }
    const detailName = detail.info?.name
    if (typeof detailName != 'string' || !artistNamesMatch(name, detailName)) continue
    return httpUrl(detail.info?.img)
  }
  return null
}

const fromTencent = async(name: string): Promise<string | null> => {
  const { body } = await txMusicSearch.musicSearch(name, 1, 8)
  const list = body?.song?.list
  if (!Array.isArray(list)) return null
  const candidates: Array<{ name?: unknown, url?: unknown }> = []
  for (const item of list) {
    const singers = Array.isArray(item?.singer) ? item.singer : []
    for (const singer of singers) {
      if (!singer?.mid) continue
      candidates.push({
        name: singer.name,
        url: `https://y.gtimg.cn/music/photo_new/T001R500x500M000${singer.mid}.jpg`,
      })
    }
  }
  return firstMatch(name, candidates)
}

const fromNetease = async(name: string): Promise<string | null> => {
  const { body } = await eapiRequest('/api/cloudsearch/pc', {
    s: name,
    type: 100,
    offset: 0,
    limit: 8,
    total: true,
  }).promise
  const payload = body as { result?: { artists?: unknown }, data?: { artists?: unknown }, artists?: unknown }
  const artists = payload?.result?.artists ?? payload?.data?.artists ?? payload?.artists
  if (!Array.isArray(artists)) return null
  return firstMatch(name, artists.map((artist: { name?: unknown, picUrl?: unknown }) => ({
    name: artist?.name,
    url: artist?.picUrl,
  })))
}

const fromKuwo = async(name: string): Promise<string | null> => {
  const request = httpFetch(`http://search.kuwo.cn/r.s?client=kt&all=${encodeURIComponent(name)}&pn=0&rn=8&ft=artist&encoding=utf8&rformat=json&mobi=1`)
  const { body, statusCode } = await request.promise
  if (statusCode != 200 || !body || typeof body != 'object') return null
  const payload = body as { abslist?: unknown, artistlist?: unknown, data?: { artistlist?: unknown } }
  const list = payload.abslist ?? payload.artistlist ?? payload.data?.artistlist ?? []
  if (!Array.isArray(list)) return null
  return firstMatch(name, list.map((item: { name?: unknown, ARTIST?: unknown, artist?: unknown, pic?: unknown, hts_PICPATH?: unknown, picpath?: unknown }) => ({
    name: item?.name ?? item?.ARTIST ?? item?.artist,
    url: item?.pic ?? item?.hts_PICPATH ?? item?.picpath,
  })))
}

const lookupUncached = async(name: string): Promise<string | null> => {
  const sources = [fromKugou, fromTencent, fromNetease, fromKuwo]
  for (const source of sources) {
    try {
      const url = await source(name)
      if (url) return url
    } catch {
      // One source failing should not block the others or the page.
    }
  }
  return null
}

export const lookupArtistAvatar = async(name: string): Promise<string | null> => {
  const trimmed = name.trim()
  if (!trimmed) return null
  await ensureLoaded()
  const cached = readCache(trimmed)
  if (cached !== undefined) return cached
  const key = normalizeArtistName(trimmed)
  const existing = pending.get(key)
  if (existing) return existing
  const task = lookupUncached(trimmed).then(url => {
    remember(trimmed, url)
    pending.delete(key)
    return url
  }).catch(() => {
    remember(trimmed, null)
    pending.delete(key)
    return null
  })
  pending.set(key, task)
  return task
}
