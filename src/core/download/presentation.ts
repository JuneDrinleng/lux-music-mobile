/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
import { downloadKey, storagePrecheck, type DownloadItem, type DownloadRequest } from './model'

export const DOWNLOAD_QUALITIES = ['128k', '320k', 'flac'] as const
export type DownloadQuality = typeof DOWNLOAD_QUALITIES[number]
export const estimateDownloadSize = (song: LX.Music.MusicInfoOnline, quality: DownloadQuality): number => {
  const size = song.meta._qualitys?.[quality]?.size
  const match = size?.match(/^([\d.]+)\s*(G|M|K|B)/i)
  if (match && Number.isFinite(Number(match[1]))) return Math.ceil(Number(match[1]) * ({ G: 1024 ** 3, M: 1024 ** 2, K: 1024, B: 1 }[match[2].toUpperCase()] ?? 1))
  const parts = song.interval?.split(':').map(Number) ?? []
  const duration = parts.length && parts.every(Number.isFinite) ? parts.reduce((sum, n) => sum * 60 + n, 0) : 240
  return Math.ceil((duration || 240) * ({ '128k': 128000, '320k': 320000, flac: 1000000 }[quality]) / 8)
}
export const downloadSheetPlan = (songs: LX.Music.MusicInfo[], items: DownloadItem[], quality: DownloadQuality, wifiOnly: boolean, free: number | null) => {
  const unique = new Map<string, LX.Music.MusicInfoOnline>()
  for (const song of songs) if (song.source != 'local') unique.set(downloadKey(song, quality), song)
  const requests: DownloadRequest[] = [...unique.values()].map(musicInfo => ({ musicInfo, quality, wifiOnly, estimatedSize: estimateDownloadSize(musicInfo, quality) }))
  const done = new Set(items.filter(item => item.state == 'done').map(item => item.key))
  const pending = requests.filter(request => !done.has(downloadKey(request.musicInfo, quality)))
  const required = pending.reduce((sum, request) => {
    const existing = items.find(item => item.key == downloadKey(request.musicInfo, quality))
    return sum + (existing && ['running', 'queued'].includes(existing.state) ? 0 : Math.max(0, request.estimatedSize - (existing?.bytes ?? 0)))
  }, 0)
  return { requests, count: requests.length, skipped: requests.length - pending.length, pending: pending.length, estimate: pending.reduce((sum, request) => sum + request.estimatedSize, 0), enough: free != null && storagePrecheck(free, required) }
}
export const downloadUsage = (items: DownloadItem[], cache: number, limit: number) => {
  const downloads = items.reduce((sum, item) => sum + Math.max(0, item.bytes), 0)
  const total = downloads + Math.max(0, cache)
  const capacity = Math.max(total, limit, 1)
  return { downloads, cache: Math.max(0, cache), total, downloadFraction: downloads / capacity, cacheFraction: Math.max(0, cache) / capacity }
}
export const downloadedPlaylists = (items: DownloadItem[]) => {
  const groups = new Map<string, { id: string, name: string, count: number, bytes: number }>()
  for (const item of items) {
    if (item.state != 'done') continue
    const memberships = Object.entries(item.playlists ?? {})
    for (const [id, name] of memberships.length ? memberships : [['', '']]) {
      const group = groups.get(id) ?? { id, name, count: 0, bytes: 0 }
      group.count++; group.bytes += item.bytes
      groups.set(id, group)
    }
  }
  return [...groups.values()]
}
export const downloadQueueAction = (state: DownloadItem['state']) => state == 'done' ? null : state == 'paused' ? 'resume' : state == 'failed' ? 'retry' : 'pause'
