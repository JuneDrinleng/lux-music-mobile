/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import state, { type TogetherConnection, type TogetherState } from './state'

type Listener = (state: TogetherState) => void
const listeners = new Set<Listener>()

const notify = () => {
  const snapshot = { ...state }
  for (const listener of listeners) listener(snapshot)
}

const resolveRole = () => {
  if (!state.room || !state.selfId) return null
  return state.room.hostId == state.selfId ? 'host' : 'member'
}

export const subscribeTogether = (listener: Listener): (() => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export default {
  setRoom(room: LX.Sync.Together.RoomSnapshot | null, selfId: string | null = state.selfId) {
    state.room = room
    state.selfId = selfId
    state.role = resolveRole()
    notify()
  },
  patchRoom(patch: Partial<LX.Sync.Together.RoomSnapshot>) {
    if (!state.room) return
    state.room = { ...state.room, ...patch }
    state.role = resolveRole()
    notify()
  },
  setConnection(connection: TogetherConnection) {
    if (state.connection == connection) return
    state.connection = connection
    notify()
  },
  setPending(pending: boolean) {
    if (state.pending == pending) return
    state.pending = pending
    notify()
  },
}
