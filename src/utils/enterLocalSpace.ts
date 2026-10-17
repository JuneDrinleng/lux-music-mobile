/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { updateSetting } from '@/core/common'
import { disconnectServer } from '@/plugins/sync'
import { setActiveSpace } from '@/utils/dataSpace'
import { saveUserName, setSyncHost } from '@/utils/data'

export const enterLocalSpace = async(label: string): Promise<void> => {
  updateSetting({ 'sync.enable': false })
  await disconnectServer()
  // Switch before profile writes, so the previous account's profile is preserved.
  await setActiveSpace('local')
  await setSyncHost('')
  await saveUserName(label)
  global.app_event.userNameUpdated(label)
}
