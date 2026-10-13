import { updateSetting } from '@/core/common'
import { pause } from '@/core/player/player'
import { disconnectServer } from '@/plugins/sync'
import playerState from '@/store/player/state'
import {
  clearLuxAuth,
  clearSyncAuthKey,
  clearSyncConflictMode,
  clearSyncLoginDraft,
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
      clearSyncLoginDraft(),
      setSyncHost(''),
    ])
  }
  await setSyncLoginCompleted(false)
}
