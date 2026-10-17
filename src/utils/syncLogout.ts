import { updateSetting } from '@/core/common'
import { pause } from '@/core/player/player'
import { disconnectServer } from '@/plugins/sync'
import playerState from '@/store/player/state'
import {
  setSyncLoginCompleted,
  getLuxAuth,
  clearLuxAuthForServer,
} from '@/utils/data'

export const applySyncAccountLogout = async() => {
  if (playerState.isPlay) await pause()
  updateSetting({ 'sync.enable': false })
  await disconnectServer()
  const session = await getLuxAuth()
  if (session) await clearLuxAuthForServer(session)
  await setSyncLoginCompleted(false)
}
