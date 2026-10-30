import { updateSetting } from '@/core/common'
import { pause } from '@/core/player/player'
import { disconnectServer } from '@/plugins/sync'
import { getActiveSpace, setActiveSpace } from '@/utils/dataSpace'
import { deleteSpaceData } from '@/utils/dataSpace/operations'
import playerState from '@/store/player/state'
import {
  setSyncLoginCompleted,
  getLuxAuth,
  clearLuxAuthForServer,
} from '@/utils/data'

export const applySyncAccountLogout = async(remove = false) => {
  const space = getActiveSpace()
  if (playerState.isPlay) await pause()
  updateSetting({ 'sync.enable': false })
  await disconnectServer()
  const session = await getLuxAuth()
  if (session) await clearLuxAuthForServer(session)
  await setSyncLoginCompleted(false)
  await setActiveSpace('local')
  if (remove && space !== 'local') await deleteSpaceData(space)
}
