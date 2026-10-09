import { SYNC_CLOSE_CODE } from '@/plugins/sync/constants'
import { registerListActionEvent } from '../../../listEvent'
import { setSyncStatus } from '@/core/sync'
import { toast } from '@/utils/tools'

let unregisterLocalListAction: (() => void) | null

const handleSyncActionFailed = (err: Error) => {
  setSyncStatus({ status: false, message: global.i18n.t('sync_action_failed_tip') })
  toast(global.i18n.t('sync_action_failed_tip'))
  console.log(err.message)
}

export const registerEvent = (socket: LX.Sync.Socket) => {
  // socket = _socket
  // socket.onClose(() => {
  //   unregisterLocalListAction?.()
  //   unregisterLocalListAction = null
  // })
  unregisterEvent()
  unregisterLocalListAction = registerListActionEvent((action) => {
    if (!socket.moduleReadys?.list) return
    void socket.remoteQueueList.onListSyncAction(action).catch(err => {
      socket.moduleReadys.list = false
      handleSyncActionFailed(err as Error)
      socket.close(SYNC_CLOSE_CODE.failed)
    })
  })
}

export const unregisterEvent = () => {
  unregisterLocalListAction?.()
  unregisterLocalListAction = null
}
