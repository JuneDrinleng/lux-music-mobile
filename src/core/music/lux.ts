/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getSyncMode, saveLyric, saveMusicUrl } from '@/utils/data'
import { log } from '@/utils/log'
import { toast } from '@/utils/tools'
import { updateListMusics } from '@/core/list'
import { setApiSource } from '@/core/apiSource'
import settingState from '@/store/setting/state'
import { getReadySyncSocket, onSyncSocketReady } from '@/plugins/sync/client/client'
import { isSourceFeatureEnabled } from '@/plugins/sync/sourceFlag'
import {
  fetchSourceInfo,
  getSourceInfo,
  onSourceInfoChanged,
  resolveLyric,
  resolveMusicUrl,
  resolvePic,
  setSourceInfo,
  toPlayableUrl,
} from '@/plugins/sync/client/modules/source'
import { toOldMusicInfo } from '@/utils'
import { readReusableMusicUrl } from './reuseMusicUrl'
import { persistCoverToUserLists } from './online'
import { buildLyricInfo, getCachedLyricInfo, getOtherSource, getPlayQuality } from './utils'

/**
 * Lux mode resolves lyrics in the App (musicSdk / user API), like lx mode.
 * Return true to send online lyrics to `source:resolveLyric` instead (see getLuxLyricInfo).
 */
export const shouldResolveLyricOnServer = (): boolean => false

const MAX_TOGGLE_CANDIDATES = 10
const TOGGLE_CODES = new Set<LX.Sync.LuxErrorCode>(['SOURCE_FAILED', 'NO_SOURCE', 'TIMEOUT'])
const UNAVAILABLE_TOAST_INTERVAL_MS = 5000

type Candidates = LX.Music.MusicInfoOnline[] | undefined
type FailedResult = Extract<LX.Sync.LuxResult<unknown>, { ok: false }>

let syncMode: LX.Sync.Mode = 'lx'
let syncModePromise: Promise<LX.Sync.Mode> | null = null
const loadSyncMode = async() => {
  syncModePromise ??= getSyncMode().then(mode => {
    syncMode = mode
    return mode
  })
  return syncModePromise
}

export const isLuxSourceMode = async(): Promise<boolean> => (await loadSyncMode()) == 'lux'

let lastUnavailableToastAt = 0
const unavailableError = (notify: boolean) => {
  const message = global.i18n.t('source_lux_server_unavailable')
  const now = Date.now()
  if (notify && now - lastUnavailableToastAt > UNAVAILABLE_TOAST_INTERVAL_MS) {
    lastUnavailableToastAt = now
    toast(message)
  }
  return new Error(message)
}

const getLuxSourceSocket = (): LX.Sync.Socket | null => isSourceFeatureEnabled() ? getReadySyncSocket() : null

const failedError = (result: FailedResult) => {
  if (result.message) log.warn(`lux source ${result.code}: ${result.message}`)
  const message = global.i18n.t(result.code == 'NO_SOURCE' || result.code == 'ACTION_UNSUPPORTED'
    ? 'source_lux_no_source'
    : 'source_lux_resolve_failed')
  toast(message)
  return new Error(message)
}

/** Server-side LX scripts (e.g. 野花) expect 1.x fields (`songmid`, `hash`, …) on the wire object. */
const toWire = (musicInfo: LX.Music.MusicInfoOnline): LX.Music.MusicInfoOnline => {
  const base = musicInfo.meta.toggleMusicInfo === undefined ? musicInfo : structuredClone(musicInfo)
  if (base.meta.toggleMusicInfo !== undefined) delete base.meta.toggleMusicInfo
  const legacy = toOldMusicInfo(base)
  legacy.songmid = String(base.meta.songId ?? base.id)
  if (base.source == 'tx' && !legacy.strMediaMid) legacy.strMediaMid = String(base.meta.strMediaMid ?? base.id)
  if (base.source == 'kg' && !legacy.hash && 'hash' in base.meta) legacy.hash = base.meta.hash
  return { ...base, ...legacy, meta: base.meta } as LX.Music.MusicInfoOnline
}

/** The server cannot search, so a failed first call is retried once with the App's other-source search results. */
const callWithToggle = async<T>(
  socket: LX.Sync.Socket,
  musicInfo: LX.Music.MusicInfoOnline,
  allowToggleSource: boolean,
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void,
  notifyUnavailable: boolean,
  call: (socket: LX.Sync.Socket, toggleCandidates: Candidates) => Promise<LX.Sync.LuxResult<T>>,
): Promise<LX.Sync.LuxResult<T>> => {
  const run = async(candidates: Candidates) => call(socket, candidates).catch((err: unknown) => {
    log.warn('lux source call failed:', err instanceof Error ? err.message : err)
    throw unavailableError(notifyUnavailable)
  })
  let result = await run(undefined)
  if (!result.ok && allowToggleSource && TOGGLE_CODES.has(result.code)) {
    onToggleSource()
    const candidates = await getOtherSource(musicInfo).catch(() => [] as LX.Music.MusicInfoOnline[])
    if (candidates.length) result = await run(candidates.slice(0, MAX_TOGGLE_CANDIDATES).map(toWire))
  }
  return result
}

export const getLuxMusicUrl = async({ musicInfo, quality, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  const targetQuality = quality ?? getPlayQuality(settingState.setting['player.playQuality'], musicInfo)
  const cachedUrl = await readReusableMusicUrl(musicInfo, targetQuality, isRefresh, true)
  if (cachedUrl) return cachedUrl

  const socket = getLuxSourceSocket()
  if (!socket) throw unavailableError(true)
  const result = await callWithToggle(socket, musicInfo, allowToggleSource, onToggleSource, true, async(socket, toggleCandidates) => resolveMusicUrl(socket, {
    musicInfo: toWire(musicInfo),
    quality: targetQuality,
    isRefresh,
    allowToggleSource,
    toggleCandidates,
  }))
  if (!result.ok) throw failedError(result)
  const data = result.data
  if (typeof data?.url != 'string' || !data.url) {
    const message = global.i18n.t('source_lux_resolve_failed')
    toast(message)
    throw new Error(message)
  }
  const url = toPlayableUrl(socket, data)
  if (data.toggled) onToggleSource(data.musicInfo)
  void saveMusicUrl(musicInfo, targetQuality, url, data.expiresAt)
  if (data.toggled || data.quality != targetQuality) void saveMusicUrl(data.musicInfo, data.quality, url, data.expiresAt)
  return url
}

export const getLuxPicUrl = async({ musicInfo, listId, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoOnline
  listId?: string | null
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<string> => {
  if (musicInfo.meta.picUrl && !isRefresh) return musicInfo.meta.picUrl
  const socket = getLuxSourceSocket()
  if (!socket) throw unavailableError(false)
  const result = await callWithToggle(socket, musicInfo, allowToggleSource, onToggleSource, false, async(socket, toggleCandidates) => resolvePic(socket, {
    musicInfo: toWire(musicInfo),
    isRefresh,
    allowToggleSource,
    toggleCandidates,
  }))
  if (!result.ok) throw failedError(result)
  const url = result.data?.url
  if (typeof url != 'string' || !url) throw new Error(global.i18n.t('source_lux_resolve_failed'))
  if (result.data.toggled) onToggleSource(result.data.musicInfo)
  musicInfo.meta.picUrl = url
  if (listId) void updateListMusics([{ id: listId, musicInfo }])
  persistCoverToUserLists(musicInfo, listId)
  return url
}

/** Only used when shouldResolveLyricOnServer() is true. NO_SOURCE / ACTION_UNSUPPORTED give an empty lyric. */
export const getLuxLyricInfo = async({ musicInfo, isRefresh, allowToggleSource = true, onToggleSource = () => {} }: {
  musicInfo: LX.Music.MusicInfoOnline
  isRefresh: boolean
  allowToggleSource?: boolean
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<LX.Player.LyricInfo> => {
  if (!isRefresh) {
    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo) return buildLyricInfo(lyricInfo)
  }
  const socket = getLuxSourceSocket()
  if (!socket) throw unavailableError(false)
  const result = await callWithToggle(socket, musicInfo, allowToggleSource, onToggleSource, false, async(socket, toggleCandidates) => resolveLyric(socket, {
    musicInfo: toWire(musicInfo),
    isRefresh,
    allowToggleSource,
    toggleCandidates,
  }))
  if (!result.ok) {
    if (result.code == 'NO_SOURCE' || result.code == 'ACTION_UNSUPPORTED') return buildLyricInfo({ lyric: '' })
    throw failedError(result)
  }
  const { lyric, musicInfo: targetMusicInfo, toggled } = result.data
  if (toggled) onToggleSource(targetMusicInfo)
  if (!result.data.fromCache) void saveLyric(toggled ? targetMusicInfo : musicInfo, lyric)
  return buildLyricInfo(lyric)
}

/** Fallback cover lookup after a cover URL failed to load. Null when nothing was found or the server is unavailable. */
export const fetchLuxAltCoverUrl = async(musicInfo: LX.Music.MusicInfoOnline): Promise<string | null> => {
  const socket = getLuxSourceSocket()
  if (!socket) return null
  const result = await callWithToggle(socket, musicInfo, true, () => {}, false, async(socket, toggleCandidates) => resolvePic(socket, {
    musicInfo: toWire(musicInfo),
    isRefresh: true,
    toggleCandidates,
  })).catch(() => null)
  const url = result?.ok ? result.data?.url : null
  return typeof url == 'string' && url.trim() ? url : null
}

export type LuxSourceStatus = 'ready' | 'no_source' | 'unavailable'

export const getLuxSourceStatus = (): LuxSourceStatus => {
  if (!getLuxSourceSocket()) return 'unavailable'
  return getSourceInfo()?.available ? 'ready' : 'no_source'
}

let qualityListFromServer = false

const toQualityList = (info: LX.Sync.Source.Info): LX.QualityList => {
  const list: LX.QualityList = {}
  for (const [source, capability] of Object.entries(info.sources) as Array<[LX.OnlineSource, LX.Sync.Source.Capability | undefined]>) {
    if (capability?.actions.includes('musicUrl')) list[source] = [...capability.qualitys]
  }
  return list
}

/** getPlayQuality and source-support checks read global.lx.qualityList, so lux mode keeps it on the server's list. */
const applyServerQualityList = (): boolean => {
  const info = getSourceInfo()
  if (syncMode != 'lux' || !info || !isSourceFeatureEnabled()) return false
  global.lx.qualityList = toQualityList(info)
  qualityListFromServer = true
  return true
}

const restoreLocalQualityList = () => {
  if (!qualityListFromServer) return
  qualityListFromServer = false
  setApiSource(settingState.setting['common.apiSource'])
  global.state_event.apiSourceUpdated(settingState.setting['common.apiSource'])
}

const refreshSourceInfo = async() => {
  const socket = getLuxSourceSocket()
  if (!socket) return
  try {
    const result = await fetchSourceInfo(socket)
    if (result.ok) setSourceInfo(result.data)
    else log.warn(`lux source getInfo ${result.code}: ${result.message}`)
  } catch (err) {
    log.warn('lux source getInfo failed:', err instanceof Error ? err.message : err)
  }
}

let started = false
export const initLuxSource = () => {
  if (started) return
  started = true
  void loadSyncMode()
  onSyncSocketReady(() => {
    void refreshSourceInfo()
  })
  onSourceInfoChanged(() => {
    if (applyServerQualityList()) global.state_event.apiSourceUpdated(settingState.setting['common.apiSource'])
  })
  // A user API that finishes initializing later would otherwise overwrite the server's list.
  global.state_event.on('apiSourceUpdated', () => {
    applyServerQualityList()
  })
  global.app_event.on('syncModeUpdated', (mode) => {
    syncMode = mode
    syncModePromise = Promise.resolve(mode)
    if (mode == 'lux') {
      if (applyServerQualityList()) global.state_event.apiSourceUpdated(settingState.setting['common.apiSource'])
      else void refreshSourceInfo()
    } else {
      restoreLocalQualityList()
    }
  })
}
