/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

const readyListeners = new Set<() => void>()

export const addSyncReadyListener = (listener: () => void) => {
  readyListeners.add(listener)
}

export const removeSyncReadyListener = (listener: () => void) => {
  readyListeners.delete(listener)
}

export const notifySyncReady = () => {
  for (const listener of readyListeners) listener()
}
