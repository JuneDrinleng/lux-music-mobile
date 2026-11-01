/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
const getSnapshot = () => Reflect.get(global.lx, 'keepPlayBarOnKeyboard') === true
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** Notify the shell even when focus/search changes while the IME stays open. */
export function setKeepPlayBarOnKeyboard(keep: boolean) {
  if (getSnapshot() === keep) return
  Reflect.set(global.lx, 'keepPlayBarOnKeyboard', keep)
  listeners.forEach(listener => { listener() })
}

export const useKeepPlayBarOnKeyboard = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
