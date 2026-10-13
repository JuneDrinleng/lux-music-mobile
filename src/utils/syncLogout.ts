import { updateSetting } from '@/core/common'
import { pause } from '@/core/player/player'
import { disconnectServer } from '@/plugins/sync'
import playerState from '@/store/player/state'
import {
  clearLuxAuth,
  clearSyncAuthKey,
  clearSyncConflictMode,
  setSyncHost,
  setSyncLoginCompleted,
} from '@/utils/data'

export const applySyncAccountLogout = async(clearSavedCredentials: boolean) => {
  if (playerState.isPlay) await pause()
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
