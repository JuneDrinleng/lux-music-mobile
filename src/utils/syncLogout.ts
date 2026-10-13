import { updateSetting } from '@/core/common'
import { disconnectServer } from '@/plugins/sync'
import {
  clearLuxAuth,
  clearSyncAuthKey,
  clearSyncConflictMode,
  setSyncHost,
  setSyncLoginCompleted,
} from '@/utils/data'

export const applySyncAccountLogout = async(clearSavedCredentials: boolean) => {
  updateSetting({ 'sync.enable': false })
  await disconnectServer()
  if (clearSavedCredentials) {
    await Promise.all([
      clearLuxAuth(),
      clearSyncAuthKey(),
      clearSyncConflictMode(),
      setSyncHost(''),
    ])
  }
  await setSyncLoginCompleted(false)
}
