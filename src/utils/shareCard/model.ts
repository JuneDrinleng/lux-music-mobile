/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type ShareLine, MAX_SHARE_LINES } from './selection'

export const SHARE_CARD_TABS = ['lyrics', 'monthly', 'annual'] as const
export type ShareCardTab = typeof SHARE_CARD_TABS[number]
export const SHARE_CARD_BACKGROUNDS = ['paper', 'accent', 'ink'] as const
export type ShareCardBackground = typeof SHARE_CARD_BACKGROUNDS[number]
/** All card types share one capture geometry, independent of device pixel density. */
export const SHARE_CARD_SIZE = { width: 1080, height: 1440 } as const
export const SHARE_CARD_FRAME = { previewWidth: 300, padding: 22, radius: 6, topRule: 3, footerGap: 20 } as const

export interface LyricCardContent {
  title: string
  artist: string
  album?: string
  cover?: string
  lines: readonly ShareLine[]
}
export interface ReportCardContent {
  title: string
  minutes: number
  playCount: number
  songCount: number
  artistCount: number
  topSongs: ReadonlyArray<{ name: string, singer: string, playCount: number }>
}
export interface ShareCardSources {
  lyrics?: LyricCardContent
  monthly?: ReportCardContent
  annual?: ReportCardContent
}
export interface ShareCardOptions {
  tab: ShareCardTab
  background: ShareCardBackground
  showTranslation: boolean
  showCover: boolean
  showNickname: boolean
}
export const initialShareCardOptions = (tab: ShareCardTab): ShareCardOptions => ({
  tab, background: 'paper', showTranslation: true, showCover: true, showNickname: true,
})

/** Pass the current 14D account profile's display name, never the login/host identifier. */
export const nicknameWatermark = (nickname: string, enabled = true): string => {
  const name = nickname.trim().replace(/^@+/, '')
  return enabled && name ? `@${name}` : ''
}

export const buildShareCard = (sources: ShareCardSources, options: ShareCardOptions, profileNickname: string) => {
  const lyric = sources.lyrics
  const validLyrics = lyric && lyric.lines.length > 0 && lyric.lines.length <= MAX_SHARE_LINES && lyric.lines.every(line => !!line.text.trim())
  const report = options.tab === 'monthly' ? sources.monthly : sources.annual
  const content = options.tab === 'lyrics'
    ? validLyrics ? {
      ...lyric,
      cover: options.showCover ? lyric.cover : undefined,
      lines: lyric.lines.map(line => ({ ...line, translation: options.showTranslation ? line.translation : undefined })),
    } : null
    : report && report.playCount > 0 ? { ...report, topSongs: report.topSongs.map(song => ({ ...song })) } : null
  return {
    tab: options.tab,
    background: options.background,
    size: SHARE_CARD_SIZE,
    frame: SHARE_CARD_FRAME,
    brand: 'LUX MUSIC',
    watermark: nicknameWatermark(profileNickname, options.showNickname),
    content,
    canExport: content !== null,
  }
}
