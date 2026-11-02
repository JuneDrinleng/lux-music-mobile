/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { Navigation } from 'react-native-navigation'
import { NativeModules } from 'react-native'
import { getPosition } from '@/plugins/player'
import { pauseForSessionSwitch, resetForSessionSwitch } from '@/plugins/player/utils'
import { AppSessionCoordinator, type SessionJournal, type SessionCandidate } from './coordinator'
import type { ActiveSession, LoginIntent } from '@/utils/loginSession'
import { freezeSession, releaseSession, selectSessionCoordinator, allowPreparedSessionSync, stopPreparedSessionSync } from '@/utils/sessionFence'
import { getActiveSpace, isDataSpaceReady, setActiveSpace, reloadActiveSpace, namespacedKey } from '@/utils/dataSpace'
import { storageDataPrefix } from '@/config/constant'

const JOURNAL = 'appSessionJournal:v1'
const ACTIVE = 'appSessionActive:v1'
let active: ActiveSession | null = null
let intent: LoginIntent | null = null
export const getLoginIntent = () => intent
export const getActiveAppSession = () => active
const pause = pauseForSessionSwitch

export const appSession = new AppSessionCoordinator({
  read: async() => {
    const raw = await AsyncStorage.getItem(JOURNAL)
    if (!raw) return null
    try {
      const journal = JSON.parse(raw) as SessionJournal
      if (journal.version === 1 && journal.intent && journal.transitionId) return journal
    } catch {}
    // Unknown/corrupt checkpoints also fail closed to the existing Gate.
    return { version: 1, phase: 'gatePending', transitionId: 'recovery', generation: 0, previous: null, pausedDownloads: [], intent: { reason: 'boot', source: 'journal-recovery', returnPolicy: 'none' } }
  },
  write: async(journal) => { await AsyncStorage.setItem(JOURNAL, JSON.stringify(journal)) },
  clear: async() => { await AsyncStorage.removeItem(JOURNAL) },
  active: () => active,
  freeze: freezeSession,
  release: () => {
    releaseSession()
    void import('@/core/download').then(async({ downloadQueue }) => downloadQueue?.releaseAfterSwitch()).catch(() => {})
  },
  pause,
  flush: async() => {
    const source = getActiveSpace()
    const { restorePersonalQueueForSwitch } = await import('@/core/together/member')
    const restoredPersonal = await restorePersonalQueueForSwitch()
    if (restoredPersonal) await resetForSessionSwitch()
    const [{ flushPlayHistory }, { saveData }, { default: player }] = await Promise.all([import('@/utils/playHistory/store'), import('@/plugins/storage'), import('@/store/player/state')])
    const { finishPlayHistorySession } = await import('@/utils/playHistory/tracker')
    finishPlayHistorySession('interrupted')
    await flushPlayHistory()
    await saveData(namespacedKey(storageDataPrefix.playInfo, source), {
      time: restoredPersonal ? player.progress.nowPlayTime : await getPosition().catch(() => player.progress.nowPlayTime),
      maxTime: player.progress.maxPlayTime,
      listId: player.playMusicInfo.listId,
      index: player.playInfo.playIndex,
      tempQueue: [...player.tempPlayList],
      tempListMetaId: (await import('@/store/list/state')).default.tempListMeta.id,
    })
  },
  pauseDownloads: async() => {
    const { downloadQueue } = await import('@/core/download')
    return await downloadQueue?.pauseForSwitch() ?? []
  },
  leave: async() => {
    const { quiesceTogetherForSwitch } = await import('@/core/together')
    await quiesceTogetherForSwitch()
  },
  disconnect: async() => {
    stopPreparedSessionSync()
    const { disconnectServer } = await import('@/plugins/sync')
    await disconnectServer()
    const { updateSetting } = await import('@/core/common')
    updateSetting({ 'sync.enable': false })
  },
  gate: async(nextIntent) => {
    if (intent === nextIntent) return
    intent = nextIntent
    const { replaceWithLoginGate } = await import('@/navigation/navigation')
    await Navigation.dismissAllModals()
    await replaceWithLoginGate(nextIntent)
    const { toast } = await import('@/utils/tools')
    toast(global.i18n.t('login_gate_paused'))
  },
  publish: async(identity) => {
    const { setSyncLoginCompleted, recordSuccessfulLogin } = await import('@/utils/data')
    await AsyncStorage.setItem(ACTIVE, JSON.stringify(identity))
    await setSyncLoginCompleted(true)
    active = identity
    // Optional recent metadata must never invalidate a successfully prepared identity.
    await recordSuccessfulLogin(identity).catch(() => {})
  },
  main: async() => {
    const { pushHomeScreen } = await import('@/navigation/navigation')
    await pushHomeScreen()
    intent = null
  },
})

export const requestLogin = async(nextIntent: LoginIntent): Promise<void> => appSession.begin(nextIntent).catch(async(error: unknown) => {
  const { toast } = await import('@/utils/tools')
  toast(error instanceof Error ? error.message : String(error), 'long')
  throw error
})

export const initializeAppSession = async(): Promise<boolean> => {
  const raw = await AsyncStorage.getItem(ACTIVE)
  if (raw) { try { active = JSON.parse(raw) as ActiveSession } catch {} }
  if (!active) {
    const data = await import('@/utils/data')
    if (await data.getSyncLoginCompleted()) {
      const mode = await data.getSyncMode()
      const auth = mode === 'lux' ? await data.getLuxAuth() : null
      if (auth?.serverId && auth.serverUrl && auth.user.id) {
        const { luxSpaceId } = await import('@/utils/dataSpace')
        const { luxCredentialRef } = await import('@/utils/loginCredentialRepository')
        // eslint-disable-next-line require-atomic-updates
        active = { provider: 'lux', spaceId: luxSpaceId(auth.serverId, auth.user.id) as `lux:${string}:${string}`, server: { serverId: auth.serverId, url: auth.serverUrl }, account: { userId: auth.user.id, username: auth.user.username }, credentialRef: luxCredentialRef(auth.serverId, auth.user.id) }
      } else if (!await data.getSyncHost()) {
        // eslint-disable-next-line require-atomic-updates
        active = { provider: 'local', spaceId: 'local' }
      }
    }
  }
  return appSession.recover()
}

export const connectAppSession = async(mode: LX.Sync.Mode, host: string, username?: string, secret?: string): Promise<void> => {
  if (!appSession.pending) await requestLogin({ reason: 'switch', source: 'connection', targetProvider: mode, initialHost: host, returnPolicy: 'restorePrevious' })
  await appSession.complete(async() => {
    if (!isDataSpaceReady()) throw new Error('Data space is not ready')
    const [{ authenticateLuxCandidate, authenticateLxCandidate }, { parseUrl }, data, socket] = await Promise.all([
      import('@/plugins/sync/client/auth'), import('@/plugins/sync/client/utils'), import('@/utils/data'), import('@/plugins/sync/client/client'),
    ])
    const url = parseUrl(host)
    const candidate = mode === 'lux' ? await authenticateLuxCandidate(url, username, secret) : await authenticateLxCandidate(url, secret)
    return {
      identity: candidate.identity,
      prepare: async() => {
        await candidate.prepare()
        if (mode === 'lx') await setActiveSpace('local')
        await reloadActiveSpace()
        await data.commitSyncMode(mode)
        await data.commitSyncHost(host)
        await data.addSyncHostHistory(host)
        // Clear native source queue and hydrate the target's saved context while paused.
        await restoreSessionPlayback()
      },
      activate: async() => {
        const { updateSetting } = await import('@/core/common')
        updateSetting({ 'sync.enable': true })
        allowPreparedSessionSync()
        socket.connect(url, candidate.keyInfo)
      },
    }
  }).catch(async(error: unknown) => {
    const { toast } = await import('@/utils/tools')
    toast(error instanceof Error ? error.message : String(error), 'long')
    throw error
  })
}

export const enterLocalAppSession = async(label: string): Promise<void> => {
  if (!appSession.pending) await requestLogin({ reason: 'switch', source: 'local', targetProvider: 'local', returnPolicy: 'restorePrevious' })
  await appSession.complete(async() => ({
    identity: { provider: 'local', spaceId: 'local' },
    prepare: async() => {
      if (!isDataSpaceReady()) throw new Error('Data space is not ready')
      await setActiveSpace('local')
      const data = await import('@/utils/data')
      await data.commitSyncHost('')
      await data.commitSyncMode('lx')
      await data.saveUserName(label)
      await restoreSessionPlayback()
    },
    activate: async() => {},
  }))
}

export const cancelAppSessionSwitch = async(): Promise<void> => appSession.cancel(async(previous): Promise<SessionCandidate> => {
  if (previous.provider === 'local') {
    return {
      identity: previous,
      prepare: async() => { await setActiveSpace('local'); await reloadActiveSpace(); const data = await import('@/utils/data'); await data.commitSyncHost(''); await data.commitSyncMode('lx'); await restoreSessionPlayback(); await pause() },
      activate: async() => {},
    }
  }
  const { authenticateLuxCandidate, authenticateLxCandidate } = await import('@/plugins/sync/client/auth')
  const { parseUrl } = await import('@/plugins/sync/client/utils')
  const candidate = previous.provider === 'lux'
    ? await authenticateLuxCandidate(parseUrl(previous.server.url), previous.account.username, undefined, previous)
    : await authenticateLxCandidate(parseUrl(previous.server.url))
  return {
    identity: candidate.identity,
    prepare: async() => {
      await candidate.prepare()
      await setActiveSpace(previous.spaceId)
      await reloadActiveSpace()
      const data = await import('@/utils/data')
      await data.commitSyncHost(previous.server.url)
      await data.commitSyncMode(previous.provider)
      await restoreSessionPlayback()
      await pause()
    },
    activate: async() => {
      const { updateSetting } = await import('@/core/common')
      updateSetting({ 'sync.enable': true })
      const { connect } = await import('@/plugins/sync/client/client')
      allowPreparedSessionSync()
      connect(parseUrl(previous.server.url), candidate.keyInfo)
    },
  }
})

export const primeSessionRecovery = async(): Promise<void> => {
  const pending = await AsyncStorage.getItem(JOURNAL)
  if (pending) freezeSession()
  else {
    const enabled = !NativeModules.DownloadModule || typeof NativeModules.DownloadModule.pauseSpace === 'function'
    selectSessionCoordinator(enabled)
    const { getSyncLoginCompleted } = await import('@/utils/data')
    if (enabled && !await getSyncLoginCompleted()) freezeSession()
  }
}

const restoreSessionPlayback = async(): Promise<void> => {
  const [{ getPlayInfo }, { getListMusics }, { setPlayMusicInfo, setPlayListId }, { setNowPlayTime, setMaxplayTime }] = await Promise.all([
    import('@/utils/data'), import('@/core/list'), import('@/core/player/playInfo'), import('@/core/player/progress'),
  ])
  await resetForSessionSwitch()
  const { default: actions } = await import('@/store/player/action')
  actions.clearTempPlayeList()
  actions.clearPlayedList()
  actions.setIsPlay(false)
  global.lx.restorePlayInfo = null
  setPlayMusicInfo(null, null)
  const info = await getPlayInfo()
  const { default: listActions } = await import('@/store/list/action')
  listActions.setTempListMeta({ id: info?.tempListMetaId ?? '' })
  if (info?.tempQueue) actions.addTempPlayList(info.tempQueue)
  if (!info?.listId || info.index < 0) return
  const songs = await getListMusics(info.listId)
  const song = songs[info.index]
  if (!song) return
  setPlayListId(info.listId)
  setPlayMusicInfo(info.listId, song)
  setNowPlayTime(info.time)
  setMaxplayTime(info.maxTime)
  global.lx.restorePlayInfo = info
}

/** Boot restoration never changes an identity. A pending transaction wins over all old callbacks. */
export const restoreAppSessionConnection = async(mode: LX.Sync.Mode, host: string): Promise<void> => {
  const { sessionGeneration, sessionWritesFrozen, isSessionCoordinatorEnabled } = await import('@/utils/sessionFence')
  if (sessionWritesFrozen() || appSession.pending) return
  if (!isSessionCoordinatorEnabled()) {
    const legacy = await import('@/plugins/sync/client')
    await (mode === 'lux' ? legacy.legacyConnectLuxServer(host) : legacy.legacyConnectServer(host))
    return
  }
  const generation = sessionGeneration()
  const [{ authenticateLuxCandidate, authenticateLxCandidate }, { parseUrl }] = await Promise.all([import('@/plugins/sync/client/auth'), import('@/plugins/sync/client/utils')])
  const candidate = mode === 'lux' ? await authenticateLuxCandidate(parseUrl(host)) : await authenticateLxCandidate(parseUrl(host))
  if (generation !== sessionGeneration() || sessionWritesFrozen()) return
  if (candidate.identity.spaceId !== getActiveSpace() || (active && candidate.identity.provider !== active.provider)) throw new Error('Restored session identity mismatch')
  await candidate.prepare()
  if (generation !== sessionGeneration() || sessionWritesFrozen()) return
  const { connect } = await import('@/plugins/sync/client/client')
  connect(parseUrl(host), candidate.keyInfo)
  await AsyncStorage.setItem(ACTIVE, JSON.stringify(candidate.identity))
  if (generation !== sessionGeneration() || sessionWritesFrozen()) return
  // eslint-disable-next-line require-atomic-updates
  active = candidate.identity
}
