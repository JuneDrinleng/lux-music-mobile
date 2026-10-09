/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type PlayRangeId } from '@/utils/playHistory/range'

export const RANGES: PlayRangeId[] = ['today', 'days7', 'month', 'year', 'all']

export const rangeLabelKey = {
  today: 'stats_range_today',
  days7: 'stats_range_days7',
  month: 'stats_range_month',
  year: 'stats_range_year',
  all: 'stats_range_all',
} as const

export const compareLabelKey = {
  today: 'stats_compare_label_today',
  days7: 'stats_compare_label_days7',
  month: 'stats_compare_label_month',
  year: 'stats_compare_label_year',
} as const

export const sharePeriodKey = {
  today: 'stats_share_today',
  days7: 'stats_share_days7',
  month: 'stats_share_month',
  year: 'stats_share_year',
  all: 'stats_share_all',
} as const

export const replayLeadKey = {
  today: 'stats_replay_lead_today',
  days7: 'stats_replay_lead_days7',
  month: 'stats_replay_lead_month',
  year: 'stats_replay_lead_year',
  all: 'stats_replay_lead_all',
} as const

export const replaySongsTitleKey = {
  today: 'stats_replay_songs_title_today',
  days7: 'stats_replay_songs_title_days7',
  month: 'stats_replay_songs_title_month',
  year: 'stats_replay_songs_title_year',
  all: 'stats_replay_songs_title_all',
} as const

export const weekdayKey = [
  'stats_weekday_0',
  'stats_weekday_1',
  'stats_weekday_2',
  'stats_weekday_3',
  'stats_weekday_4',
  'stats_weekday_5',
  'stats_weekday_6',
] as const

export const pad2 = (value: number) => (value < 10 ? `0${value}` : String(value))
