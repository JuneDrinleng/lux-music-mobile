/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { PAGE_GUTTER } from '@/theme/magazineType'

/**
 * Shared bottom transport dock (seek + times + control row) for play / lyric pages.
 * Design numbers on the 375 baseline; createStyle scales them.
 */
export const PLAYER_TRANSPORT = {
  paddingHorizontal: PAGE_GUTTER,
  paddingTop: 8,
  /** Distance from dock bottom to the page bottom — keep play & lyric identical. */
  paddingBottom: 18,
  playBtn: 56,
  timeMarginBottom: 6,
} as const
