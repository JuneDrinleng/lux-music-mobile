/** Shared choices and presentation for the existing timeoutExit timer. */
export const SLEEP_TIMER_MINUTES = [15, 30, 45, 60, 90] as const
export const SLEEP_TIMER_FADE_SECONDS = [10, 30, 60] as const
export const SHOW_SLEEP_TIMER_NOISE = true

export const sleepTimerMinutes = (value: string) => {
  const minutes = Number(value)
  return Number.isInteger(minutes) && minutes > 0 && minutes <= 1440 ? minutes : 30
}
export const sleepTimerFadeSeconds = (value: number) => (
  SLEEP_TIMER_FADE_SECONDS.includes(value as 10 | 30 | 60) ? value : 30
)
export const formatSleepTimer = (seconds: number) => {
  const time = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(time / 60).toString().padStart(2, '0')}:${(time % 60).toString().padStart(2, '0')}`
}
export const sleepTimerPill = (seconds: number, waiting: boolean) => (
  seconds >= 0 || waiting ? `☾ ${formatSleepTimer(seconds)}` : ''
)
