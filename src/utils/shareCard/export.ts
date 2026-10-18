/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { SHARE_CARD_SIZE } from './model'
import { captureRef, releaseCapture } from 'react-native-view-shot'
import { type RefObject } from 'react'
import { type View } from 'react-native'
import { shareImage } from '@/utils/nativeModules/utils'

/** Capture only the mounted, non-collapsible card, never its editing controls. */
export const nativeCardExport = (view: RefObject<View>, title: string): CardExportDependencies => ({
  capture: async options => {
    if (!view.current) throw new Error('Share card is not mounted')
    return await captureRef(view, options)
  },
  share: async uri => { await shareImage(title, uri) },
  release: releaseCapture,
})

export interface CardCaptureOptions {
  width: number
  height: number
  format: 'png'
  result: 'tmpfile'
}
export interface CardExportDependencies {
  capture: (options: CardCaptureOptions) => Promise<string>
  share: (uri: string) => Promise<void>
  release: (uri: string) => void
}

/** Capture failures alone may fall back to the monthly text report. Share errors propagate.
 * The native share bridge copies the capture before resolving, so releasing here is safe.
 */
export const captureAndShareCard = async(
  canExport: boolean,
  dependencies: CardExportDependencies,
  captureFallback?: () => Promise<void>,
): Promise<'image' | 'fallback'> => {
  if (!canExport) throw new Error('Cannot export an empty share card')
  let uri: string
  try {
    uri = await dependencies.capture({ ...SHARE_CARD_SIZE, format: 'png', result: 'tmpfile' })
    if (!uri) throw new Error('Capture returned no file')
  } catch (error) {
    if (!captureFallback) throw error
    await captureFallback()
    return 'fallback'
  }
  try {
    await dependencies.share(uri)
    return 'image'
  } finally {
    dependencies.release(uri)
  }
}
