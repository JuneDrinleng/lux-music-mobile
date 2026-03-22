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

