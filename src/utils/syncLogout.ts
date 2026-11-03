/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { isSessionCoordinatorEnabled } from '@/utils/sessionFence'
import { requestLogin } from '@/core/appSession'
import { getActiveSpace } from '@/utils/dataSpace'
import { deleteSpaceData } from '@/utils/dataSpace/operations'
import { getLuxAuth, clearLuxAuthForServer, setSyncLoginCompleted } from '@/utils/data'

export const applySyncAccountLogout = async(remove = false) => {
  const space = getActiveSpace()
  const session = await getLuxAuth()
  if (!isSessionCoordinatorEnabled()) {
    const [{ pause }, { disconnectServer }, { updateSetting }] = await Promise.all([import('@/core/player/player'), import('@/plugins/sync'), import('@/core/common')])
    await pause()
    updateSetting({ 'sync.enable': false })
    await disconnectServer()
    const { setActiveSpace } = await import('@/utils/dataSpace')
    await setActiveSpace('local')
  } else await requestLogin({ reason: 'logout', source: 'account-logout', returnPolicy: 'none' })
  if (session) await clearLuxAuthForServer(session)
  await setSyncLoginCompleted(false)
  if (remove && space !== 'local') await deleteSpaceData(space, isSessionCoordinatorEnabled())
}
