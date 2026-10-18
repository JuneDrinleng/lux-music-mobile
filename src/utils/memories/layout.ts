/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type StatsPageStyle } from '../playHistory/statsPageStyle'

/** Independent of the existing Magazine/Replay detail preference. */
export type MemoriesLayout = 'monthly' | 'cards' | 'timeline'
export const DEFAULT_MEMORIES_LAYOUT: MemoriesLayout = 'monthly'
export const MEMORIES_LAYOUTS: readonly MemoriesLayout[] = ['monthly', 'cards', 'timeline']
export const normalizeMemoriesLayout = (value: unknown): MemoriesLayout =>
  value === 'cards' || value === 'timeline' ? value : DEFAULT_MEMORIES_LAYOUT

export const selectStatsLayout = (layout: unknown, pageStyle: StatsPageStyle, details = false) =>
  details ? pageStyle : normalizeMemoriesLayout(layout)
