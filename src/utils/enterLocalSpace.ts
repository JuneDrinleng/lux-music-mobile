/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { enterLocalAppSession } from '@/core/appSession'
import { isSessionCoordinatorEnabled } from '@/utils/sessionFence'
export const enterLocalSpace = async(label: string): Promise<void> => {
  if (isSessionCoordinatorEnabled()) return enterLocalAppSession(label)
  const [{ updateSetting }, { disconnectServer }, { setActiveSpace }, data] = await Promise.all([import('@/core/common'), import('@/plugins/sync'), import('@/utils/dataSpace'), import('@/utils/data')])
  updateSetting({ 'sync.enable': false })
  await disconnectServer()
  await setActiveSpace('local')
  await data.commitSyncMode('lx')
  await data.commitSyncHost('')
  await data.saveUserName(label)
  global.app_event.userNameUpdated(label)
}
