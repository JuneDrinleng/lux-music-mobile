/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

type Listener = (info: LX.Sync.Source.Info | null) => void

let current: LX.Sync.Source.Info | null = null
const listeners = new Set<Listener>()

export const getSourceInfo = (): LX.Sync.Source.Info | null => current

export const setSourceInfo = (info: LX.Sync.Source.Info | null) => {
  current = info
  for (const listener of listeners) listener(info)
}

export const onSourceInfoChanged = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
