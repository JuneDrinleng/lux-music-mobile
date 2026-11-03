import { sessionGeneration, sessionWritesFrozen } from '@/utils/sessionFence'
/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
export type DownloadState = 'queued' | 'running' | 'paused' | 'failed' | 'done'
export interface DownloadRequest {
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  wifiOnly: boolean
  estimatedSize: number
  expectedSize?: number
}
export interface DownloadItem extends DownloadRequest {
  playlists?: Record<string, string>
  id: string
  workId: string
  key: string
  space: string
  state: DownloadState
  error: string
  bytes: number
  total?: number
}
export interface DownloadBridge {
  pauseSpace?: (space: string) => Promise<string>
  releaseSpace?: (space: string) => Promise<void>
  enqueue: (space: string, payload: string) => Promise<string>
  snapshot: (space: string) => Promise<string>
  reconcile: (space: string) => Promise<string>
  command: (space: string, key: string, action: 'pause' | 'resume' | 'retry') => Promise<string | null>
  offlinePath: (space: string, key: string) => Promise<string | null>
  removeSpace: (space: string) => Promise<void>
  attachPlaylist: (space: string, keys: string, id: string, name: string) => Promise<string>
  removePlaylist: (space: string, id: string) => Promise<string>
  availableBytes: () => Promise<number>
  batteryStatus: () => Promise<boolean>
  openBatterySettings: () => Promise<boolean>
}
export const downloadKey = (song: Pick<LX.Music.MusicInfoOnline, 'source' | 'id'>, quality: LX.Quality): string => JSON.stringify([song.source, song.id, quality])
export const storagePrecheck = (free: number, estimated: number, downloaded = 0): boolean =>
  Number.isFinite(free) && Number.isFinite(estimated) && estimated >= 0 && free >= Math.max(0, estimated - downloaded) + 8 * 1024 * 1024

/** Native transitions are authoritative. This policy also guards commands from future UI. */
export const canDownloadCommand = (state: DownloadState, action: 'pause' | 'resume' | 'retry'): boolean =>
  action == 'pause' ? ['queued', 'running', 'failed'].includes(state) : action == 'resume' ? state == 'paused' : state == 'failed'

export const createDownloadQueue = (deps: {
  bridge: DownloadBridge
  space: () => string
  resolveUrl: (request: DownloadRequest, refresh: boolean) => Promise<string>
}) => {
  let items: DownloadItem[] = []
  let revision = 0
  const listeners = new Set<() => void>()
  const refreshing = new Set<string>()
  // Bound automatic refreshes even if a provider keeps returning expired URLs.
  const refreshed = new Set<string>()
  const publish = (raw: string, space: string, ticket: number) => {
    if (space != deps.space() || ticket != revision) return
    items = JSON.parse(raw) as DownloadItem[]
    for (const item of items) if (item.state == 'done') refreshed.delete(item.id)
    for (const listener of listeners) listener()
  }
  const enqueueFor = async(requests: DownloadRequest[], space: string, refresh: boolean) => {
    if (sessionWritesFrozen()) throw new Error('SESSION_FROZEN')
    const sessionTicket = sessionGeneration()
    for (const request of requests) {
      if (!Number.isSafeInteger(request.estimatedSize) || request.estimatedSize < 0 || typeof request.wifiOnly != 'boolean' || (request.expectedSize != null && (!Number.isSafeInteger(request.expectedSize) || request.expectedSize < 0))) throw new Error('DOWNLOAD_INPUT')
    }
    const required = requests.reduce((sum, item) => {
      const existing = items.find(row => row.space == space && row.key == downloadKey(item.musicInfo, item.quality))
      if (existing?.state == 'done' || existing?.state == 'running' || existing?.state == 'queued') return sum
      return sum + Math.max(0, Math.max(item.estimatedSize, item.expectedSize ?? 0) - (existing?.bytes ?? 0))
    }, 0)
    if (!storagePrecheck(await deps.bridge.availableBytes(), required)) throw new Error('INSUFFICIENT_STORAGE')
    const generation = revision
    const payload = await Promise.all(requests.map(async request => ({
      ...request,
      key: downloadKey(request.musicInfo, request.quality),
      ...(refresh && 'workId' in request ? { refreshWorkId: request.workId } : {}),
      url: await deps.resolveUrl(request, refresh),
    })))
    if (sessionWritesFrozen() || sessionTicket !== sessionGeneration() || space != deps.space()) return
    const ticket = generation == revision ? ++revision : -1
    publish(await deps.bridge.enqueue(space, JSON.stringify(payload)), space, ticket)
  }
  const refreshExpired = async(space: string) => {
    const failures = items.filter(item => item.state == 'failed' && item.error == 'URL_EXPIRED' && !refreshed.has(item.id) && !refreshing.has(item.id))
    await Promise.all(failures.map(async item => {
      refreshing.add(item.id)
      refreshed.add(item.id)
      try {
        // Capture ownership before URL resolution; a space switch cancels publication.
        await enqueueFor([item], space, true)
      } catch { /* Leave the native failure available for explicit retry. */ } finally { refreshing.delete(item.id) }
    }))
  }
  const sync = async(reconcile = false) => {
    const space = deps.space()
    const ticket = ++revision
    const raw = await ((reconcile && !sessionWritesFrozen()) ? deps.bridge.reconcile(space) : deps.bridge.snapshot(space))
    publish(raw, space, ticket)
    if (!sessionWritesFrozen() && space == deps.space() && ticket == revision) await refreshExpired(space)
  }
  return {
    pauseForSwitch: async(): Promise<string[]> => {
      ++revision
      const space = deps.space()
      if (!deps.bridge.pauseSpace) throw new Error('DOWNLOAD_PAUSE_UNAVAILABLE')
      const paused = JSON.parse(await deps.bridge.pauseSpace(space)) as DownloadItem[]
      const snapshot = JSON.parse(await deps.bridge.snapshot(space)) as DownloadItem[]
      if (snapshot.some(item => item.state === 'queued' || item.state === 'running')) throw new Error('DOWNLOAD_PAUSE_FAILED')
      return paused.map(item => item.id)
    },
    releaseAfterSwitch: async() => { await deps.bridge.releaseSpace?.(deps.space()) },
    getSnapshot: () => items,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    clear: () => { ++revision; items = []; for (const listener of listeners) listener() },
    sync,
    availableBytes: async() => deps.bridge.availableBytes(),
    enqueuePlaylist: async(requests: DownloadRequest[], id: string, name: string) => {
      const space = deps.space()
      const pending = requests.filter(request => !items.some(item => item.key == downloadKey(request.musicInfo, request.quality) && ['done', 'running', 'queued'].includes(item.state)))
      if (pending.length) await enqueueFor(pending, space, false)
      if (space != deps.space()) return
      const ticket = ++revision
      publish(await deps.bridge.attachPlaylist(space, JSON.stringify(requests.map(request => downloadKey(request.musicInfo, request.quality))), id, name), space, ticket)
    },
    removePlaylist: async(id: string) => {
      const space = deps.space()
      const ticket = ++revision
      publish(await deps.bridge.removePlaylist(space, id), space, ticket)
    },
    enqueue: async(requests: DownloadRequest[]) => enqueueFor(requests, deps.space(), false),
    command: async(key: string, action: 'pause' | 'resume' | 'retry') => {
      if (sessionWritesFrozen()) return
      const item = items.find(item => item.key == key)
      if (!item || !canDownloadCommand(item.state, action)) return
      const space = deps.space()
      if (action == 'resume') refreshed.delete(item.id)
      if (action == 'retry' && item.error == 'URL_EXPIRED') {
        refreshed.delete(item.id)
        await enqueueFor([item], space, true)
      } else {
        const ticket = ++revision
        const raw = await deps.bridge.command(space, key, action)
        if (raw) publish(raw, space, ticket)
      }
    },
    offline: async(song: LX.Music.MusicInfoOnline, quality?: LX.Quality): Promise<string | null> => {
      const space = deps.space()
      // A native stat is required on every hit. Missing/deleted downloads are a no-op.
      const candidates = items.filter(item => item.space == space && item.state == 'done' && item.musicInfo.source == song.source && item.musicInfo.id == song.id && (!quality || item.quality == quality))
      for (const item of candidates) {
        const path = await deps.bridge.offlinePath(space, item.key).catch(() => null)
        if (space != deps.space()) return null
        if (path) return path
      }
      return null
    },
  }
}
