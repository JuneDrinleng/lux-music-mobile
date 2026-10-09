// 这个文件导出的方法将暴露给服务端调用，第一个参数固定为当前 socket 对象
// import { getUserSpace } from '@/user'
// import { modules } from '../modules'

import { getSyncMode } from '@/utils/data'

import { setPlayHistoryFeatureEnabled } from '../../playHistoryFlag'
import { featureVersion } from '../modules'


const handler: Omit<LX.Sync.ClientSyncHandlerActions<LX.Sync.Socket>, 'finished'> = {
  async getEnabledFeatures(socket, serverType, supportedFeatures) {
  // const userSpace = getUserSpace(socket.userInfo.name)
    const features: LX.Sync.EnabledFeatures = {}
    let lux = false
    try {
      lux = await getSyncMode() == 'lux'
    } catch {
      lux = false
    }
    // Old servers omit playHistory. LX connection-code sync must not enable it, so records stay on this device.
    const enablePlayHistory = lux && featureVersion.playHistory == supportedFeatures.playHistory
    setPlayHistoryFeatureEnabled(enablePlayHistory)
    switch (serverType) {
      case 'server':
        if (featureVersion.list == supportedFeatures.list) {
          features.list = { skipSnapshot: false }
        }
        if (featureVersion.dislike == supportedFeatures.dislike) {
          features.dislike = { skipSnapshot: false }
        }
        if (enablePlayHistory) features.playHistory = true
        return features
      case 'desktop-app':
      default:
        if (featureVersion.list == supportedFeatures.list) {
          features.list = { skipSnapshot: false }
        }
        if (featureVersion.dislike == supportedFeatures.dislike) {
          features.dislike = { skipSnapshot: false }
        }
        if (enablePlayHistory) features.playHistory = true
        return features
    }
  },
}

export default handler
