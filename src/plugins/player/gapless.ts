/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import TrackPlayer from 'react-native-track-player'
import { NativeModules } from 'react-native'
import settingState from '@/store/setting/state'
import playerState from '@/store/player/state'
import togetherState from '@/store/together/state'
import { subscribeTogether } from '@/store/together/action'
import { getMusicUrl } from '@/core/music'
import { acceptGaplessTrack, getNextPlayMusicInfo, playNext, setMusicUrl } from '@/core/player/player'
import { finishTimeoutExit, getTimeoutExitTime, onTimeUpdate } from '@/core/player/timeoutExit'
import { buildGaplessTrack, getCurrentTrack, restoreLegacyTail, trackNativeQueue } from './playList'

interface Bridge {
  setGaplessPlayback?: (enabled: boolean) => Promise<void>
  setGaplessNext?: (currentId: string, track: LX.Player.Track | null) => Promise<boolean>
}
const bridge = NativeModules.TrackPlayerModule as Bridge | undefined
export const isGaplessEnabled = () => settingState.setting['player.audio.gapless.enabled'] && typeof bridge?.setGaplessPlayback === 'function' && typeof bridge?.setGaplessNext === 'function'

let epoch = 0
let loading = false
interface StagedTrack { id: string, from: LX.Player.PlayMusic | null, next: LX.Player.PlayMusicInfo, epoch: number }
const stagedTracks = new Map<string, StagedTrack>()
let attempted: LX.Player.PlayMusic | null = null
let failedMusic: LX.Player.PlayMusic | null = null
const allowed = () => isGaplessEnabled() && togetherState.role !== 'member' && !global.lx.isPlayedStop && !(settingState.setting['player.timeoutExitPlayed'] && getTimeoutExitTime() >= 0)
const sameNext = (a: LX.Player.PlayMusicInfo, b: LX.Player.PlayMusicInfo | null) => b != null && a.musicInfo === b.musicInfo && a.listId === b.listId && a.isTempPlay === b.isTempPlay

export const invalidateGapless = () => {
  epoch++
  attempted = null
  if (!isGaplessEnabled()) return
  void getCurrentTrack().then(async track => track && bridge!.setGaplessNext!(track.id as string, null)).catch(() => {})
}

/** Independent from the legacy URL warmer. Failures have no user-facing side effects. */
export const preloadGapless = async(position: number, duration: number) => {
  if (!allowed() || loading || duration <= 10 || duration - position > 10 || duration - position <= 0) return
  const from = playerState.playMusicInfo.musicInfo
  if (!from || attempted === from) return
  attempted = from
  loading = true
  const token = epoch
  const valid = () => token === epoch && allowed() && playerState.playMusicInfo.musicInfo === from
  try {
    const current = await getCurrentTrack()
    const next = await getNextPlayMusicInfo()
    if (!current || !next || !valid()) return
    const url = await getMusicUrl({ musicInfo: next.musicInfo })
    const selected = await getNextPlayMusicInfo()
    if (!url || !valid() || !sameNext(next, selected)) return
    const track = buildGaplessTrack(next.musicInfo, url)
    trackNativeQueue()
    const staged = { id: track.id as string, from, next, epoch: token }
    stagedTracks.set(staged.id, staged)
    if (stagedTracks.size > 4) stagedTracks.delete(stagedTracks.keys().next().value!)
    const added = await bridge!.setGaplessNext!(current.id as string, track)
    if (!added) {
      stagedTracks.delete(track.id as string)
    }
    // An invalidation sent during the bridge call is ordered after it on the player looper.
  } catch {
    // URL/source failures retain ordinary end-of-queue switching.
  } finally {
    // Other calls only read this lock until this request completes.
    // eslint-disable-next-line require-atomic-updates
    loading = false
  }
}

export const handleGaplessTransition = async(id: string) => {
  const staged = stagedTracks.get(id)
  stagedTracks.delete(id)
  if (!staged || playerState.playMusicInfo.musicInfo !== staged.from) return
  if ((await getCurrentTrack())?.id !== id) return
  const selected = await getNextPlayMusicInfo()
  if (!allowed() || staged.epoch !== epoch || !sameNext(staged.next, selected)) {
    await TrackPlayer.pause()
    if (global.lx.isPlayedStop) await finishTimeoutExit()
    else if (togetherState.role !== 'member') await playNext(true)
    return
  }
  global.lx.playerTrackId = id
  await acceptGaplessTrack(staged.next)
  const index = await TrackPlayer.getCurrentTrack()
  if (index != null && index > 0) await TrackPlayer.remove(Array.from({ length: index }, (_, i) => i))
  return true
}

export const handleGaplessFallback = async(id: string) => {
  if (!isGaplessEnabled() || (await getCurrentTrack())?.id !== id) return
  const wasStaged = stagedTracks.has(id)
  const adopted = await handleGaplessTransition(id)
  if (wasStaged && !adopted) return
  invalidateGapless()
  // Retry each native item once, then use the existing playerError recovery.
  const music = playerState.playMusicInfo.musicInfo
  if (failedMusic === music) { global.app_event.playerError(); return }
  failedMusic = music
  if (music && !global.lx.isPlayedStop) setMusicUrl(music, true)
}

export const initGapless = () => {
  const invalidate = () => { if (isGaplessEnabled()) invalidateGapless() }
  global.app_event.on('musicToggled', invalidate)
  global.app_event.on('setProgress', invalidate)
  global.app_event.on('myListMusicUpdate', invalidate)
  global.app_event.on('downloadListUpdate', invalidate)
  global.state_event.on('playTempPlayListChanged', invalidate)
  global.state_event.on('configUpdated', keys => {
    if (!keys.some(key => key === 'player.togglePlayMethod' || key.startsWith('player.timeoutExit') || key === 'player.audio.gapless.enabled')) return
    invalidateGapless()
    if (!isGaplessEnabled()) void restoreLegacyTail().catch(() => {})
  })
  let role = togetherState.role
  subscribeTogether(() => {
    if (role === togetherState.role) return
    role = togetherState.role
    invalidate()
  })
  let timerState = ''
  onTimeUpdate((time, stopped) => {
    const state = `${time >= 0}:${stopped}`
    if (state === timerState) return
    timerState = state
    invalidate()
  })
}
