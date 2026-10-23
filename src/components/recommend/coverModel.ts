/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { type Recommendation } from '@/utils/recommend'

export const recommendationMonths = ['recommend_month_1', 'recommend_month_2', 'recommend_month_3', 'recommend_month_4', 'recommend_month_5', 'recommend_month_6', 'recommend_month_7', 'recommend_month_8', 'recommend_month_9', 'recommend_month_10', 'recommend_month_11', 'recommend_month_12'] as const

export const coveredRecommendations = (items: Recommendation[]) => items.flatMap(item => {
  const cover = (item.song.img ?? item.musicInfo?.meta.picUrl)?.trim()
  return cover ? [{ item, cover }] : []
})

// Use the same font conversion as common/Text; do not send these through createStyle again.
export const dayNumberMetrics = (scaleText: (size: number) => number, scaleGap: (size: number) => number) => ({
  fontSize: scaleText(100),
  lineHeight: Math.max(scaleText(104), scaleText(100)),
  gap: Math.max(10, scaleGap(10)),
})

export const weeklyCover = (discover: { cover: string | null }) => {
  const cover = discover.cover?.trim()
  if (!cover) return undefined
  return cover
}

export const currentRecommendationWeek = (date: Date) => {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  // UTC calendar arithmetic avoids DST changing the ISO week number.
  const thursday = new Date(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3))
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((thursday.getTime() - yearStart) / 86400000 + 1) / 7)
  return { monday, sunday, week }
}
