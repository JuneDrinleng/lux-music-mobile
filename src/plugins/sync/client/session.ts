/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export type SessionState = 'connecting' | 'negotiated' | 'togetherReady' | 'togetherUnsupported' | 'closed'

export interface Session {
  readonly id: number
  readonly state: SessionState
  readonly togetherFeatures?: LX.Sync.SupportedFeatures
}

interface MutableSession extends Session {
  state: SessionState
  togetherFeatures?: LX.Sync.SupportedFeatures
  cleanups: Set<() => void>
}

let sequence = 0
let current: MutableSession | null = null
const sockets = new WeakMap<object, MutableSession>()
const listeners = new Set<() => void>()
const notify = () => { for (const listener of listeners) listener() }

export const getSession = (): Session | null => current
export const getSocketSession = (socket: object): Session | undefined => sockets.get(socket)
export const isCurrentSession = (id: number | undefined): boolean => id != null && current?.id == id && current?.state != 'closed'
export const subscribeSession = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const closeSession = (id: number) => {
  if (current?.id != id || current.state == 'closed') return
  const session = current
  session.state = 'closed'
  for (const cleanup of session.cleanups) cleanup()
  session.cleanups.clear()
  notify()
}

export const createSession = (socket: object): Session => {
  if (current) closeSession(current.id)
  current = { id: ++sequence, state: 'connecting', cleanups: new Set() }
  sockets.set(socket, current)
  notify()
  return current
}

export const onSessionClose = (id: number, cleanup: () => void) => {
  if (isCurrentSession(id)) current!.cleanups.add(cleanup)
}

export const negotiateTogether = (id: number, enabled: boolean, supportedFeatures?: LX.Sync.SupportedFeatures) => {
  if (!isCurrentSession(id)) return
  const features = enabled ? supportedFeatures : undefined
  const previousFeatures = current!.togetherFeatures
  const featuresChanged = (['together.chat', 'together.reaction', 'together.request'] as const)
    .some(key => previousFeatures?.[key] != features?.[key])
  current!.togetherFeatures = features ? { ...features } : undefined
  // A repeated handshake never resets an already ready module.
  const next = enabled ? (current!.state == 'togetherReady' ? 'togetherReady' : 'negotiated') : 'togetherUnsupported'
  if (current!.state == next) {
    if (featuresChanged) notify()
    return
  }
  current!.state = next
  notify()
}

export const finishTogether = (id: number) => {
  if (!isCurrentSession(id) || current!.state != 'negotiated') return
  current!.state = 'togetherReady'
  notify()
}

/** Pre-#25 servers finish the handshake without a together_sync_finished call. */
export const finishSessionHandshake = finishTogether
export const isSessionTogetherReady = (): boolean => current?.state == 'togetherReady'
export const isSessionTogetherNegotiated = (): boolean => current?.state == 'negotiated' || isSessionTogetherReady()
