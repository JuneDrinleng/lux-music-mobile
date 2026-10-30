/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { NativeModules, PermissionsAndroid, Platform } from 'react-native'
import { SHARE_CARD_SIZE } from './model'
import { type CardExportDependencies } from './export'

type SaveMessage = 'share_card_saved' | 'share_card_save_failed' | 'share_card_save_denied'

/** Permission is requested before capturing. The native promise resolves after the image is published. */
export const saveCardToGallery = async(
  canExport: boolean,
  capture: Pick<CardExportDependencies, 'capture' | 'release'>,
  ui: { isActive: () => boolean, notify: (key: SaveMessage) => void },
): Promise<string | undefined> => {
  let file: string | undefined
  const notify = (key: SaveMessage) => { if (ui.isActive()) ui.notify(key) }
  try {
    if (!canExport || !ui.isActive()) return
    if (Platform.OS !== 'android') throw new Error('Gallery saving requires Android')
    if (Number(Platform.Version) >= 23 && Number(Platform.Version) < 29) {
      const permission = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE)
      if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
        notify('share_card_save_denied')
        return
      }
    }
    if (!ui.isActive()) return
    file = await capture.capture({ ...SHARE_CARD_SIZE, format: 'png', result: 'tmpfile' })
    if (!file) throw new Error('Capture returned no file')
    if (!ui.isActive()) return
    const gallery = NativeModules.GalleryModule as { saveImage: (path: string) => Promise<string> } | undefined
    if (!gallery) throw new Error('Gallery module unavailable')
    const uri = await gallery.saveImage(file)
    if (!uri?.startsWith('content://')) throw new Error('Gallery returned no content URI')
    notify('share_card_saved')
    return uri
  } catch (error) {
    notify((error as { code?: string })?.code === 'E_PERMISSION_DENIED' ? 'share_card_save_denied' : 'share_card_save_failed')
  } finally {
    if (file) capture.release(file)
  }
}
