/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export type TogetherRole = 'host' | 'member'

/**
 * `offline`: the sync socket is not ready.
 * `unsupported`: the socket is ready but the server did not enable together for it (old server, or LX mode).
 */
export type TogetherConnection = 'online' | 'offline' | 'unsupported'

export interface TogetherState {
  room: LX.Sync.Together.RoomSnapshot | null
  /** This device's memberId (sync clientId). */
  selfId: string | null
  role: TogetherRole | null
  connection: TogetherConnection
  /** A create / join / leave call is in flight. */
  pending: boolean
}

const state: TogetherState = {
  room: null,
  selfId: null,
  role: null,
  connection: 'offline',
  pending: false,
}

export default state
