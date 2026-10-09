/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export type MagToastTone = 'default' | 'danger'

export interface MagToastPayload {
  message: string
  tone?: MagToastTone
  icon?: string
  durationMs?: number
}

type Listener = (payload: MagToastPayload) => void

const listeners = new Set<Listener>()

/** Fire-and-forget toast for magazine surfaces. Wired from utils/tools.toast. */
export const showMagToast = (payload: MagToastPayload) => {
  if (listeners.size === 0) return false
  for (const listener of listeners) listener(payload)
  return true
}

export const subscribeMagToast = (listener: Listener) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
