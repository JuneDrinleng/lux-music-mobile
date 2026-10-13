/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import BackgroundTimer from 'react-native-background-timer'

import { callTogether } from '@/plugins/sync/client/modules/together/api'
import { log } from '@/utils/log'

import {
  CLOCK_BURST_COUNT,
  CLOCK_BURST_GAP_MS,
  CLOCK_INTERVAL_MS,
  makeClockSample,
  pickClockOffset,
  pushClockSample,
  type ClockSample,
} from './math'

let clockOffsetMs = 0
let samples: ClockSample[] = []
let intervalId: number | null = null
let burstToken = 0

const wait = async(ms: number) => new Promise<void>(resolve => { BackgroundTimer.setTimeout(resolve, ms) })

const pingOnce = async(): Promise<ClockSample | null> => {
  const t0 = Date.now()
  try {
    const result = await callTogether('together:ping', { t0 })
    const t1 = Date.now()
    if (!result.ok || typeof result.data?.serverTime != 'number') return null
    return makeClockSample(t0, t1, result.data.serverTime)
  } catch (error) {
    log.warn('together ping failed:', error instanceof Error ? error.message : error)
    return null
  }
}

const recordSample = (sample: ClockSample) => {
  samples = pushClockSample(samples, sample)
  const offset = pickClockOffset(samples)
  if (offset != null) clockOffsetMs = offset
}

export const getServerNow = (): number => Date.now() + clockOffsetMs

/** Ping 5 times 200ms apart and take the lowest-RTT offset, then keep pinging every 60s. */
export const startClockSync = async(): Promise<void> => {
  const token = ++burstToken
  stopClockTimer()
  const burst: ClockSample[] = []
  for (let i = 0; i < CLOCK_BURST_COUNT; i += 1) {
    if (token != burstToken) return
    const sample = await pingOnce()
    if (sample) burst.push(sample)
    if (i < CLOCK_BURST_COUNT - 1) await wait(CLOCK_BURST_GAP_MS)
  }
  if (token != burstToken) return
  samples = burst
  const offset = pickClockOffset(burst)
  if (offset != null) clockOffsetMs = offset
  intervalId = BackgroundTimer.setInterval(() => {
    void pingOnce().then(sample => {
      if (sample && token == burstToken) recordSample(sample)
    })
  }, CLOCK_INTERVAL_MS)
}

const stopClockTimer = () => {
  if (intervalId == null) return
  BackgroundTimer.clearInterval(intervalId)
  intervalId = null
}

export const stopClockSync = () => {
  burstToken += 1
  stopClockTimer()
}
