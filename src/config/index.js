/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

// import resolveAssetSource from 'react-native/Libraries/Image/resolveAssetSource'
import { Platform } from 'react-native'
import defaultUrl from '@/resources/medias/Silence02s.mp3'
// const defaultUrl = resolveAssetSource(resourceDefaultUrl).uri

const notificationIcon = Platform.OS === 'android'
  ? { uri: 'notification_appicon' }
  : undefined

export {
  defaultUrl,
  notificationIcon,
}
// export const defaultUrl = require('@/resources/medias/Silence02s.mp3')

