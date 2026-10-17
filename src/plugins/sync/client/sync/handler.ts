// 这个文件导出的方法将暴露给服务端调用，第一个参数固定为当前 socket 对象
// import { getUserSpace } from '@/user'
// import { modules } from '../modules'

import { getSyncMode } from '@/utils/data'

import { setPlayHistoryFeatureEnabled } from '../../playHistoryFlag'
import { setTogetherFeatureEnabled } from '../../togetherFlag'
import { notifySyncReady } from '../syncReady'
import { setSyncModuleReady } from '../moduleReadys'
import { featureVersion } from '../modules'


const handler: Omit<LX.Sync.ClientSyncHandlerActions<LX.Sync.Socket>, 'finished'> = {
  async together_sync_finished(socket) {
    // Server only calls this after togetherModule.sync; do not gate on the client flag
    // (stale reconnect close can clear flags before this callback arrives).
    setTogetherFeatureEnabled(true)
    setSyncModuleReady(socket, 'together', true)
    if (socket.isReady) setTimeout(notifySyncReady, 0)
  },
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
    const enableTogether = lux && featureVersion.together == supportedFeatures.together
    setTogetherFeatureEnabled(enableTogether)
    if (enableTogether) setSyncModuleReady(socket, 'together', true)
    switch (serverType) {
      case 'server':
        if (featureVersion.list == supportedFeatures.list) {
          features.list = { skipSnapshot: false }
        }
        if (featureVersion.dislike == supportedFeatures.dislike) {
          features.dislike = { skipSnapshot: false }
        }
        if (enablePlayHistory) features.playHistory = true
        if (enableTogether) features.together = true
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
        if (enableTogether) features.together = true
        return features
    }
  },
}

export default handler
