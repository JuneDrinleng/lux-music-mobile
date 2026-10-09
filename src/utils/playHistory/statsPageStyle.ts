/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Magazine = A 大字杂志风. Replay = C 年度回顾风. */
export type StatsPageStyle = 'magazine' | 'replay'

export const DEFAULT_STATS_PAGE_STYLE: StatsPageStyle = 'magazine'

export const STATS_PAGE_STYLES: readonly StatsPageStyle[] = ['magazine', 'replay']

export const normalizeStatsPageStyle = (value: unknown): StatsPageStyle => {
  return value == 'replay' ? 'replay' : 'magazine'
}
