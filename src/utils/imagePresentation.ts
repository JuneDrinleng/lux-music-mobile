/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { limeColors } from '../theme/luxTokens'

export const COVER_PLACEHOLDER_COLOR = limeColors.surface.placeholder
export const COVER_FADE_MS = 150

const HTTP_URI = /^https?:\/\//i

export interface CoverPresentation {
  uri: string | null
  /** Cache hit: the first frame is already the bitmap, with no fade and no placeholder. */
  loaded: boolean
  fadeIn: boolean
  /** Cache miss: one disk download, then show the file. Do not also paint the remote URL. */
  waitForDownload: boolean
}

export const coverPresentation = (input: {
  rawUri: string
  cacheEnabled: boolean
  peekedFileUri: string | null
}): CoverPresentation => {
  if (!input.rawUri) {
    return { uri: null, loaded: false, fadeIn: false, waitForDownload: false }
  }
  const remote = HTTP_URI.test(input.rawUri)
  if (!remote || !input.cacheEnabled) {
    return {
      uri: input.rawUri,
      loaded: !remote,
      fadeIn: remote,
      waitForDownload: false,
    }
  }
  if (input.peekedFileUri) {
    return { uri: input.peekedFileUri, loaded: true, fadeIn: false, waitForDownload: false }
  }
  return { uri: null, loaded: false, fadeIn: true, waitForDownload: true }
}

/**
 * A remote URL that is already on screen stays there.
 * Swapping it for file:// remounts the native image and flashes the placeholder.
 * The file is used the next time the component mounts.
 */
export const nextCoverUri = (
  currentUri: string | null,
  downloadedFileUri: string | null,
  rawUri: string,
): string | null => {
  if (currentUri && HTTP_URI.test(currentUri)) return currentUri
  if (downloadedFileUri) return downloadedFileUri
  if (currentUri) return currentUri
  return rawUri || null
}
