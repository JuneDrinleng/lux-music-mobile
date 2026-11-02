/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { listLuxAuthSessions } from '@/utils/data'
import { storageDataPrefix } from '@/config/constant'
import { getData } from '@/plugins/storage'
import { getActiveSpace, listSpaces, luxSpaceId, namespacedKey, type DataSpace } from '@/utils/dataSpace'
import { readSpaceContents } from '@/utils/dataSpace/operations'

export const loadAccountSpaces = async() => {
  const [stored, sessions] = await Promise.all([listSpaces(), listLuxAuthSessions()])
  const spaces: DataSpace[] = stored.some(space => space.id === 'local') ? stored : [{ id: 'local', kind: 'local', lastActiveAt: 0 }, ...stored]
  return Promise.all(spaces.map(async space => {
    const session = sessions.find(auth => auth.serverId && luxSpaceId(auth.serverId, auth.user.id) === space.id)
    const name = await getData<string>(namespacedKey(storageDataPrefix.userName, space.id))
    const trimmedName = name?.trim()
    return { space: { ...space, label: trimmedName?.length ? trimmedName : space.label, host: space.host ?? session?.serverUrl }, session, contents: await readSpaceContents(space.id) }
  }))
}
export const switchAccountSpace = async(space: DataSpace, session?: LX.Sync.LuxAuth): Promise<void> => {
  if (space.id === getActiveSpace()) return
  const { requestLogin } = await import('@/core/appSession')
  await requestLogin({ reason: 'switch', source: 'account-spaces', targetProvider: space.id === 'local' ? 'local' : 'lux', initialHost: space.host ?? session?.serverUrl, returnPolicy: 'restorePrevious' })
}
