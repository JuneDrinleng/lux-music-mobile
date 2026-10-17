/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getReadySyncSocket } from '../../client'
import { isTogetherSyncReady } from '../../togetherReady'
import { getSession, isCurrentSession } from '../../session'

export { setTogetherPushListener, type TogetherPush } from './pushBus'

type Actions = LX.Sync.ServerSyncTogetherActions
type Payload<K extends keyof Actions> = Parameters<Actions[K]>
type Result<K extends keyof Actions> = Awaited<ReturnType<Actions[K]>>

export class TogetherUnavailableError extends Error {}

/** Throws TogetherUnavailableError when the socket is not ready or the server did not enable together. */
export const callTogether = async<K extends keyof Actions>(method: K, ...args: Payload<K>): Promise<Result<K>> => {
  const socket = getReadySyncSocket()
  const id = getSession()?.id
  if (!socket || !isTogetherSyncReady()) {
    throw new TogetherUnavailableError('together is not enabled')
  }
  const remote = socket.remote as unknown as Actions
  const result = await (remote[method] as (...params: Payload<K>) => Promise<Result<K>>)(...args)
  if (!isCurrentSession(id)) throw new TogetherUnavailableError('stale session')
  return result
}

export const getTogetherSelfId = (): string | null => getReadySyncSocket()?.data.keyInfo.clientId ?? null
