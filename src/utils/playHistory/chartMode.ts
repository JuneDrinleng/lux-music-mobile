/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export type StatsChartMode = 'bar' | 'line'

export const DEFAULT_STATS_CHART_MODE: StatsChartMode = 'bar'

/** Accept only the two chart modes; anything else falls back to bars. */
export const normalizeStatsChartMode = (value: unknown): StatsChartMode => {
  return value == 'line' ? 'line' : 'bar'
}
