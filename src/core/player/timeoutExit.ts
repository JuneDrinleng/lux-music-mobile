import { useEffect, useState } from 'react'
import BackgroundTimer from 'react-native-background-timer'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { cancelNativeFadeOut, getDuration, getPosition, isNativeFadeOutSupported, restoreSleepTimerVolume, setPause, setSleepTimerGain, startNativeFadeOut } from '@/plugins/player/utils'
import { fadeGain, songRemainingSeconds } from '@/plugins/player/volumeFade'

import { sleepTimerFadeSeconds, SLEEP_TIMER_MINUTES } from './sleepTimerOptions'

type Hook = (time: number, isPlayedStop: boolean) => void

let generation = 0
let ticking = false
let faded = false
let nativeKey = ''
let nativeFailed = false
let deadlineAt = 0

const cancelNativeFade = async() => {
  if (!nativeKey) return
  nativeKey = ''
  await cancelNativeFadeOut()
}

const syncNativeFade = async() => {
  const current = generation
  if (!isNativeFadeOutSupported || nativeFailed) return false
  if (!settingState.setting['player.timeoutExitFade']) {
    await cancelNativeFade()
    return false
  }
  const duration = sleepTimerFadeSeconds(settingState.setting['player.timeoutExitFadeDuration']) * 1000
  const finishSong = settingState.setting['player.timeoutExitPlayed']
  const key = `${generation}:${deadlineAt}:${duration}:${finishSong}`
  if (nativeKey !== key) {
    nativeKey = key
    try {
      await startNativeFadeOut(duration, deadlineAt, finishSong, key)
    } catch (err) {
      if (current !== generation) return true
      console.log('Native sleep timer unavailable, using JS fade', err)
      // The generation check above prevents a replaced request from changing this session.
      // eslint-disable-next-line require-atomic-updates
      nativeFailed = true
      await cancelNativeFade().catch(console.log)
      return false
    }
  }
  return true
}

const restoreVolume = async() => {
  if (!faded) return
  faded = false
  await restoreSleepTimerVolume()
}

const timeoutTools = {
  bgTimeout: null as number | null,
  timeout: null as number | null,
  startTime: 0,
  time: -1,
  timeHooks: [] as Hook[],
  getTime() {
    return this.time < 0 ? -1 : Math.max(this.time - Math.floor((performance.now() - this.startTime) / 1000), 0)
  },
  callHooks() {
    const time = this.getTime()
    for (const hook of this.timeHooks) hook(time, global.lx.isPlayedStop)
  },
  clearTimeout() {
    generation++
    if (this.bgTimeout !== null) BackgroundTimer.clearTimeout(this.bgTimeout)
    if (this.timeout !== null) BackgroundTimer.clearInterval(this.timeout)
    this.bgTimeout = null
    this.timeout = null
    this.time = -1
    this.callHooks()
  },
  async tick() {
    if (ticking) return
    ticking = true
    const current = generation
    try {
      if (this.time < 0 && !global.lx.isPlayedStop) {
        this.clearTimeout()
        await restoreVolume()
        return
      }
      if (await syncNativeFade()) {
        this.callHooks()
        return
      }
      if (current !== generation) return
      let remaining = Infinity
      if (settingState.setting['player.timeoutExitFade'] && playerState.isPlay) {
        if (global.lx.isPlayedStop) {
          // Only fade the song after the deadline; unknown/live durations skip fading.
          const [position, duration] = await Promise.all([getPosition(), getDuration()])
          const configuredRate = settingState.setting['player.playbackRate']
          const rate = Number.isFinite(configuredRate) ? Math.max(0.25, Math.min(4, configuredRate)) : 1
          remaining = songRemainingSeconds(Number(position), Number(duration), rate)
        } else if (!settingState.setting['player.timeoutExitPlayed']) {
          remaining = this.time - (performance.now() - this.startTime) / 1000
        }
      }
      if (current !== generation) return
      const gain = fadeGain(remaining, sleepTimerFadeSeconds(settingState.setting['player.timeoutExitFadeDuration']))
      if (gain < 1) {
        faded = true
        await setSleepTimerGain(gain)
      } else await restoreVolume()
      this.callHooks()
    } catch (err) {
      console.log('Sleep timer fade failed', err)
    } finally {
      // This lock is held across awaits; other ticks only read it and return.
      // eslint-disable-next-line require-atomic-updates
      ticking = false
    }
  },
  start(time: number) {
    this.clearTimeout()
    global.lx.isPlayedStop = false
    void cancelNativeFade().catch(console.log)
    nativeFailed = false
    void restoreVolume().catch(console.log)
    this.time = time
    deadlineAt = Date.now() + time * 1000
    this.startTime = performance.now()
    this.bgTimeout = BackgroundTimer.setTimeout(() => {
      this.bgTimeout = null
      this.time = -1
      if (settingState.setting['player.timeoutExitPlayed'] && playerState.isPlay) {
        global.lx.isPlayedStop = true
        this.callHooks()
        void this.tick()
      } else void finishTimeoutExit()
    }, time * 1000)
    void syncNativeFade().catch(console.log)
    this.timeout = BackgroundTimer.setInterval(() => { void this.tick() }, 250)
    this.callHooks()
  },
  addTimeHook(hook: Hook) {
    this.timeHooks.push(hook)
    hook(this.getTime(), global.lx.isPlayedStop)
  },
  removeTimeHook(hook: Hook) {
    const index = this.timeHooks.indexOf(hook)
    if (index >= 0) this.timeHooks.splice(index, 1)
  },
}

// Pause before restoring output to avoid a full-volume burst at the deadline/song end.
export const finishTimeoutExit = async() => {
  global.lx.isPlayedStop = false
  timeoutTools.clearTimeout()
  const current = generation
  try {
    await setPause()
  } catch (err) {
    console.log('Sleep timer pause failed', err)
  }
  if (current !== generation) return
  await cancelNativeFade().catch(console.log)
  await restoreVolume().catch(console.log)
}


// Ignore completion events queued by a cancelled/replaced native countdown.
export const onNativeFadeEnded = (requestId: string) => {
  if (nativeKey && requestId === nativeKey) void finishTimeoutExit()
}

export const startTimeoutExit = (time: number) => {
  timeoutTools.start(time)
}
export const stopTimeoutExit = () => {
  global.lx.isPlayedStop = false
  timeoutTools.clearTimeout()
  void cancelNativeFade().catch(console.log)
  void restoreVolume().catch(console.log)
}

// Reuse the sheet's timer engine and presets without launching an activity over the lock screen.
export const cycleNotificationSleepTimer = () => {
  const running = timeoutTools.time >= 0 || global.lx.isPlayedStop
  const currentMinutes = timeoutTools.time / 60
  const next = running ? SLEEP_TIMER_MINUTES.find(minutes => minutes > currentMinutes) : SLEEP_TIMER_MINUTES[0]
  if (next == null || global.lx.isPlayedStop) cancelTimeoutExit()
  else startTimeoutExit(next * 60)
}

export const getTimeoutExitTime = () => {
  return timeoutTools.time
}

export const useTimeoutExitTimeInfo = () => {
  const [info, setInfo] = useState({ time: timeoutTools.getTime(), isPlayedStop: global.lx.isPlayedStop })
  useEffect(() => {
    const hook: Hook = (time, isPlayedStop) => {
      setInfo({ time, isPlayedStop })
    }
    timeoutTools.addTimeHook(hook)
    return () => { timeoutTools.removeTimeHook(hook) }
  }, [setInfo])

  return info
}

export const onTimeUpdate = (handler: Hook) => {
  timeoutTools.addTimeHook(handler)

  return () => {
    timeoutTools.removeTimeHook(handler)
  }
}


export const cancelTimeoutExit = () => {
  stopTimeoutExit()
}
