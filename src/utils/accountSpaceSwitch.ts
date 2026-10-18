/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { updateSetting } from '@/core/common'
import { pause } from '@/core/player/player'
import playerState from '@/store/player/state'
import { connectLuxServer, disconnectServer } from '@/plugins/sync'
import { navigations } from '@/navigation'
import { listLuxAuthSessions, setLuxAuth, setSyncHost, setSyncMode, setSyncLoginCompleted } from '@/utils/data'
import { storageDataPrefix } from '@/config/constant'
import { getData } from '@/plugins/storage'
import { getActiveSpace, listSpaces, luxSpaceId, namespacedKey, setActiveSpace, type DataSpace } from '@/utils/dataSpace'
import { readSpaceContents, switchRoute } from '@/utils/dataSpace/operations'

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
  const route = switchRoute(space, session)
  if (route === 'login') {
    await navigations.pushSyncLoginScreen({ onboarding: false, initialHost: space.host ?? '', initialUsername: space.username ?? space.label })
    return
  }
  if (playerState.isPlay) await pause()
  updateSetting({ 'sync.enable': false })
  await disconnectServer()
  if (route === 'local') {
    await setSyncLoginCompleted(false)
    await setActiveSpace('local')
    await setSyncHost('')
  } else if (session?.serverUrl) {
    await setLuxAuth(session)
    await setSyncMode('lux')
    await setSyncHost(session.serverUrl)
    await connectLuxServer(session.serverUrl, session.user.username)
    await setSyncLoginCompleted(true)
    updateSetting({ 'sync.enable': true })
  } else throw new Error('Account host unavailable')
  await navigations.pushHomeScreen()
}

