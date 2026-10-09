/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/**
 * Magazine typography + vertical rhythm (design numbers on a 375 baseline).
 * Handed to createStyle / Text for scaling. See docs/design-system-magazine.md §3.3 / §3.4 / §8.2.
 */

export const PAGE_GUTTER = 22

export const RULE_GAP = 34
export const RULE_GAP_COMPACT = 22
export const RULE_TO_SECTION = 12
export const SECTION_TO_LIST = 6

export const TOP_BAR_MARGIN_TOP = 10
export const H1_AFTER_TOP = 18
export const EYEBROW_AFTER_H1 = 8
export const TABS_AFTER_EYEBROW = 22
export const DISPLAY_AFTER_TABS = 28

export const ROW_MIN_HEIGHT = 64
export const SETTING_ROW_MIN_HEIGHT = 62
export const OPTION_ROW_MIN_HEIGHT = 58
export const SHEET_ROW_MIN_HEIGHT = 56
export const COVER_LIST = 46
export const COVER_SHEET_IMPORT = 40
export const COVER_SHEET_QUEUE = 36
export const ICON_BLOCK = 34

export const magType = {
  displayXL: { size: 120, lineHeight: 120, weight: '800' as const, letterSpacing: -6 },
  displayL: { size: 56, lineHeight: 56, weight: '800' as const, letterSpacing: -3 },
  h1: { size: 40, lineHeight: 44, weight: '800' as const, letterSpacing: -1 },
  h2: { size: 32, lineHeight: 38, weight: '800' as const, letterSpacing: -0.8 },
  section: { size: 22, lineHeight: 28, weight: '800' as const, letterSpacing: -0.3 },
  dialogTitle: { size: 22, lineHeight: 28, weight: '800' as const, letterSpacing: -0.3 },
  sheetTitle: { size: 20, lineHeight: 26, weight: '800' as const, letterSpacing: -0.3 },
  sheetFigure: { size: 56, lineHeight: 56, weight: '800' as const, letterSpacing: -2 },
  eyebrow: { size: 11, lineHeight: 14, weight: '700' as const, letterSpacing: 2 },
  sectionMeta: { size: 12, lineHeight: 16, weight: '600' as const, letterSpacing: 1 },
  tab: { size: 15, lineHeight: 20, weightOn: '800' as const, weightOff: '600' as const },
  tabSm: { size: 13, lineHeight: 18, weightOn: '800' as const, weightOff: '600' as const },
  rank: { size: 30, lineHeight: 30, weight: '800' as const, letterSpacing: -1 },
  index: { size: 15, lineHeight: 20, weight: '700' as const },
  rowTitle: { size: 16, lineHeight: 22, weight: '700' as const },
  body: { size: 15, lineHeight: 22, weight: '400' as const },
  lead: { size: 15, lineHeight: 22, weight: '400' as const },
  meta: { size: 12, lineHeight: 16, weight: '400' as const },
  value: { size: 15, lineHeight: 20, weight: '800' as const },
  valueUnit: { size: 11, lineHeight: 14, weight: '600' as const },
  footnote: { size: 10, lineHeight: 13, weight: '400' as const },
  tick: { size: 10, lineHeight: 13, weight: '400' as const, weightOn: '700' as const },
  button: { size: 15, lineHeight: 20, weight: '700' as const },
  textButton: { size: 14, lineHeight: 18, weight: '700' as const },
  searchInput: { size: 24, lineHeight: 30, weight: '800' as const },
  settingsSearch: { size: 15, lineHeight: 20, weight: '600' as const },
} as const

export type MagTypeKey = keyof typeof magType
