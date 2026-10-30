/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export interface SyncModuleReadyMap {
  list: boolean
  dislike: boolean
  playHistory: boolean
  together: boolean
}

export type SyncModuleReadyName = keyof SyncModuleReadyMap

interface SyncSocketLike { moduleReadys?: SyncModuleReadyMap }

export const createInitialModuleReadys = (): SyncModuleReadyMap => ({
  list: false,
  dislike: false,
  playHistory: false,
  together: false,
})

export const resetModuleReadys = (socket: SyncSocketLike | null | undefined) => {
  if (!socket) return
  socket.moduleReadys = createInitialModuleReadys()
}

export const isSyncModuleReady = (
  socket: SyncSocketLike | null | undefined,
  module: SyncModuleReadyName,
): boolean => Boolean(socket?.moduleReadys?.[module])

export const setSyncModuleReady = (
  socket: SyncSocketLike | null | undefined,
  module: SyncModuleReadyName,
  ready: boolean,
) => {
  if (!socket?.moduleReadys) return
  socket.moduleReadys[module] = ready
}

const TOGETHER_RPC_NOT_READY = /together is not enabled|moduleReadys/i

/** Maps server-side sync guard failures and message2call TypeErrors to a user-facing not-ready state. */
export const isTogetherRpcNotReadyError = (message: string): boolean => (
  TOGETHER_RPC_NOT_READY.test(message)
)
