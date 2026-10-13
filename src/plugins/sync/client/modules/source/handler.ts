/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// 这个文件导出的方法将暴露给服务端调用，第一个参数固定为当前 socket 对象
import { isSourceFeatureEnabled } from '../../../sourceFlag'
import { setSourceInfo } from './state'

const handler: WarpSyncHandlerActions<LX.Sync.Socket, LX.Sync.ClientSyncSourceActions> = {
  async 'source:onInfoChanged'(socket, info) {
    if (!isSourceFeatureEnabled()) return
    setSourceInfo(info)
  },
}

export default handler
