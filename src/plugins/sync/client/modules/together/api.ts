/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getReadySyncSocket } from '../../client'
import { isTogetherFeatureEnabled } from '../../../togetherFlag'

export { setTogetherPushListener, type TogetherPush } from './pushBus'

type Actions = LX.Sync.ServerSyncTogetherActions
type Payload<K extends keyof Actions> = Parameters<Actions[K]>
type Result<K extends keyof Actions> = Awaited<ReturnType<Actions[K]>>

export class TogetherUnavailableError extends Error {}

/** Throws TogetherUnavailableError when the socket is not ready or the server did not enable together. */
export const callTogether = async<K extends keyof Actions>(method: K, ...args: Payload<K>): Promise<Result<K>> => {
  const socket = getReadySyncSocket()
  if (!socket || !isTogetherFeatureEnabled()) throw new TogetherUnavailableError('together is not enabled')
  const remote = socket.remote as unknown as Actions
  return (remote[method] as (...params: Payload<K>) => Promise<Result<K>>)(...args)
}

export const getTogetherSelfId = (): string | null => getReadySyncSocket()?.data.keyInfo.clientId ?? null
