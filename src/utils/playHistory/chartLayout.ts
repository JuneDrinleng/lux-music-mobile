/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type ChartBucket, type PlayRangeId } from './range'

const weekdayKeys = [
  'stats_weekday_0',
  'stats_weekday_1',
  'stats_weekday_2',
  'stats_weekday_3',
  'stats_weekday_4',
  'stats_weekday_5',
  'stats_weekday_6',
] as const

export const statsBucketLabel = (
  bucket: ChartBucket,
  range: PlayRangeId,
  t: (key: string, params?: Record<string, string | number>) => string,
): { text: string, highlight: boolean, show: boolean } => {
  let text: string
  let show = true
  if (bucket.kind == 'hour2') {
    text = t('stats_hour_label', { hour: bucket.hour })
  } else if (bucket.kind == 'day') {
    if (range == 'days7') text = bucket.isCurrent ? t('stats_today') : t(weekdayKeys[bucket.weekday])
    else {
      text = String(bucket.dayOfMonth)
      show = bucket.isCurrent || bucket.dayOfMonth == 1 || bucket.dayOfMonth % 5 == 0
    }
  } else if (bucket.kind == 'month') text = t('stats_month_label', { month: bucket.month + 1 })
  else text = String(bucket.year)
  return { text, highlight: bucket.isCurrent, show }
}

/** Shared pixel coordinates keep bars, line points and axis labels in the same slots. */
export const buildStatsChartLayout = (
  buckets: readonly ChartBucket[],
  width: number,
  maxHeight: number,
  minimumHeight = 4,
) => {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1
  const safeHeight = Number.isFinite(maxHeight) && maxHeight > 0 ? maxHeight : 1
  const minHeight = Math.min(safeHeight, Math.max(0, minimumHeight))
  const slotWidth = safeWidth / Math.max(1, buckets.length)
  const values = buckets.map(bucket => Number.isFinite(bucket.listenedMs) ? Math.max(0, bucket.listenedMs) : 0)
  const maxValue = Math.max(0, ...values)
  return {
    width: safeWidth,
    slotWidth,
    points: buckets.map((bucket, index) => {
      const value = values[index]
      // Rounded display minutes can be zero even when a short listen is present.
      const height = value > 0 ? Math.max(minHeight, value / maxValue * safeHeight) : 0
      return {
        bucket,
        x: (index + 0.5) * slotWidth,
        height,
        y: safeHeight - height,
        empty: value <= 0,
      }
    }),
  }
}
