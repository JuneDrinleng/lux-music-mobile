/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { contrastRatio, mixHex, readableOn, relativeLuminance, rgbaHex, shiftHue } from './luxColorMath'
import { type LuxColors, type LuxHeroCard, type LuxHomeCard, type LuxSourceTone, type LuxSwatch, type LuxThemeMode } from './luxTokens'

/** themes.json 里的角色。没有单独槽位的颜色由这些角色推导。 */
export interface LuxSeed {
  mode: LuxThemeMode
  bgApp: string
  surface: string
  surfaceMuted: string
  placeholder: string
  divider: string
  inkStrong: string
  ink: string
  inkSecondary: string
  inkMuted: string
  inkFaint: string
  accent: string
  accentSoft: string
  accentNav: string
  accentOn: string
  danger: string
  like: string
  search: string
  searchBorder: string
  cancelBg: string
  cancelText: string
  navInactive: string
  cover1: string
  cover2: string
}

const paper = '#ffffff'
const black = '#000000'

const distinct = (candidate: string, occupied: string[], toward: string) => {
  let current = candidate
  let amount = 0.12
  while (occupied.some(color => color.toLowerCase() === current.toLowerCase()) && amount < 0.8) {
    current = mixHex(candidate, toward, amount)
    amount += 0.12
  }
  return current
}

const pastelCard = (accent: string, paperTone: string, ink: string, dark: boolean): LuxHomeCard => {
  const surface = dark ? mixHex(accent, paperTone, 0.74) : mixHex(accent, paper, 0.8)
  const soft = dark ? mixHex(surface, paperTone, 0.45) : mixHex(surface, paper, 0.5)
  return {
    surface,
    accent,
    ink: readableOn(mixHex(accent, ink, dark ? 0.15 : 0.45), surface, 4.5),
    soft,
  }
}

const swatch = (accent: string, surface: string, ink: string): LuxSwatch => ({
  surface,
  accent,
  ink: readableOn(ink, surface, 4.5),
})

const sourceTone = (text: string, background: string, page: string): LuxSourceTone => {
  const bg = relativeLuminance(page) < 0.4 ? mixHex(text, page, 0.78) : mixHex(text, paper, 0.9)
  return {
    text: readableOn(text, bg, 3),
    background: background || bg,
  }
}

export const buildLuxColors = (seed: LuxSeed): LuxColors => {
  const dark = seed.mode === 'dark'
  const lift = dark ? seed.surfaceMuted : paper
  const field = (amount: number) => mixHex(seed.surface, dark ? seed.surfaceMuted : seed.bgApp, amount)
  const line = (amount: number) => mixHex(seed.divider, dark ? seed.surfaceMuted : paper, amount)
  const ink = (amount: number) => mixHex(seed.inkStrong, seed.inkFaint, amount)
  const accentChip = distinct(mixHex(seed.accent, seed.accentNav, 0.45), [seed.accent, seed.accentNav, seed.accentSoft], lift)
  const accentThumb = distinct(mixHex(seed.accentNav, lift, dark ? 0.2 : 0.35), [seed.accent, seed.accentNav, seed.accentSoft, accentChip], lift)
  const accentShadow = distinct(mixHex(seed.accent, black, 0.32), [seed.accent, seed.accentNav], black)
  const accentHighlight = readableOn(mixHex(seed.accent, dark ? paper : black, 0.28), seed.bgApp, 3)
  const olive = readableOn(mixHex(seed.accent, seed.inkStrong, dark ? 0.2 : 0.62), seed.bgApp, 4.5)
  const play = dark ? seed.inkStrong : seed.inkStrong
  const skip = dark ? seed.ink : readableOn(mixHex(seed.inkStrong, seed.ink, 0.35), seed.bgApp, 4.5)
  const localPlayer = dark
    ? readableOn(mixHex('#94a3b8', seed.inkSecondary, 0.35), seed.bgApp, 3)
    : readableOn(mixHex('#64748b', seed.inkMuted, 0.25), seed.bgApp, 3)
  const localDetail = distinct(
    dark
      ? readableOn(mixHex('#cbd5e1', seed.ink, 0.2), seed.bgApp, 3)
      : readableOn(mixHex('#475569', seed.inkSecondary, 0.35), seed.bgApp, 3),
    [localPlayer],
    dark ? paper : black,
  )
  const unknownBg = dark ? mixHex(seed.divider, seed.surface, 0.35) : mixHex(seed.divider, paper, 0.55)
  const queueUnknownBg = distinct(dark ? mixHex(seed.surfaceMuted, seed.surface, 0.4) : mixHex(seed.placeholder, paper, 0.4), [unknownBg], lift)
  const neutral = dark ? mixHex(seed.surfaceMuted, seed.divider, 0.35) : mixHex(paper, seed.divider, 0.42)
  const glassBase = dark ? seed.surface : paper
  const rim = dark ? mixHex(seed.surfaceMuted, seed.inkFaint, 0.2) : mixHex(seed.bgApp, paper, 0.78)
  const rimWarm = mixHex(rim, seed.cover1, dark ? 0.35 : 0.18)
  const scrim = dark ? black : seed.inkStrong
  const iconWrap = (tint: string) => dark ? mixHex(tint, seed.surface, 0.62) : mixHex(tint, paper, 0.82)
  const hero = (accent: string, surface: string): LuxHeroCard => ({
    surface,
    accent,
    ink: readableOn(mixHex(accent, seed.inkStrong, dark ? 0.1 : 0.5), surface, 4.5),
    textSoft: readableOn(mixHex(accent, seed.inkSecondary, 0.35), surface, 3),
  })
  const tx = sourceTone('#31c27c', '', seed.surface)
  const wy = sourceTone(dark ? '#f07167' : '#d81e06', '', seed.surface)
  const kg = sourceTone(dark ? '#60a5fa' : '#2f88ff', '', seed.surface)
  const kw = sourceTone(dark ? '#fbbf24' : '#f59e0b', '', seed.surface)
  const mg = sourceTone(dark ? '#f472b6' : '#e11d8d', '', seed.surface)

  const colors: LuxColors = {
    bg: {
      app: seed.bgApp,
      plain: seed.surface,
    },
    surface: {
      card: seed.surface,
      muted: seed.surfaceMuted,
      mutedAlt: mixHex(seed.surfaceMuted, seed.surface, 0.45),
      well: field(dark ? 0.55 : 0.22),
      avatar: mixHex(seed.cover1, seed.surface, dark ? 0.55 : 0.42),
      placeholder: seed.placeholder,
      skeleton: mixHex(seed.placeholder, seed.divider, 0.45),
      search: seed.search,
      cancel: seed.cancelBg,
      neutral,
      backBubble: field(dark ? 0.35 : 0.18),
      backInner: mixHex(seed.placeholder, seed.surface, 0.35),
      importMuted: field(dark ? 0.7 : 0.38),
      importField: mixHex(seed.surfaceMuted, seed.surface, dark ? 0.25 : 0.62),
      importSelected: mixHex(seed.accentSoft, seed.surface, dark ? 0.35 : 0.55),
      queueAlt: field(dark ? 0.8 : 0.48),
      playerTrack: mixHex(seed.placeholder, seed.divider, 0.4),
      sourceActive: mixHex(seed.surfaceMuted, seed.surface, 0.28),
      actionDisabled: field(dark ? 0.4 : 0.28),
      songlistCard: field(dark ? 0.62 : 0.42),
      confirmDisabled: field(dark ? 0.3 : 0.16),
      emptyBlock: field(dark ? 0.48 : 0.12),
      searchEmpty: mixHex(seed.surface, seed.bgApp, dark ? 0.2 : 0.12),
      segment: mixHex(seed.divider, seed.bgApp, dark ? 0.25 : 0.35),
      segmentAlt: mixHex(seed.divider, seed.surface, dark ? 0.2 : 0.28),
      heroFallback: mixHex(seed.inkStrong, black, dark ? 0.55 : 0.72),
      playGlass: mixHex(seed.inkStrong, black, dark ? 0.35 : 0.78),
      vinyl: mixHex(black, seed.inkStrong, dark ? 0.08 : 0.04),
    },
    ink: {
      pageTitle: readableOn(mixHex(seed.inkStrong, seed.ink, 0.28), seed.bgApp, 4.5),
      subpageTitle: readableOn(mixHex(seed.inkStrong, seed.ink, 0.45), seed.bgApp, 4.5),
      list: readableOn(seed.ink, seed.bgApp, 4.5),
      strong: seed.inkStrong,
      input: readableOn(mixHex(seed.ink, seed.inkStrong, 0.4), seed.bgApp, 4.5),
      secondary: seed.inkSecondary,
      eyebrow: seed.inkMuted,
      option: readableOn(mixHex(seed.inkSecondary, seed.inkMuted, 0.4), seed.bgApp, 3),
      meta: readableOn(mixHex(seed.inkSecondary, seed.inkMuted, 0.65), seed.surface, 3),
      faint: seed.inkFaint,
      quiet: mixHex(seed.inkFaint, seed.inkMuted, 0.35),
      cancel: seed.cancelText,
      searchIcon: mixHex(seed.inkSecondary, seed.inkMuted, 0.45),
      searchClearIdle: mixHex(seed.divider, seed.inkFaint, dark ? 0.35 : 0.5),
      navActive: readableOn(dark ? seed.accentNav : mixHex(seed.inkStrong, seed.accent, 0.16), seed.bgApp, 4.5),
      navIdle: seed.navInactive,
      icon: dark ? seed.inkStrong : black,
      onControl: dark ? seed.bgApp : paper,
      nearBlack: dark ? seed.ink : mixHex(black, seed.inkStrong, 0.15),
      lyricNav: readableOn(seed.inkStrong, seed.bgApp, 4.5),
      rowTitle: readableOn(mixHex(seed.inkStrong, seed.ink, 0.2), seed.bgApp, 4.5),
      cardTitle: readableOn(seed.ink, seed.surface, 4.5),
      emptyAction: readableOn(seed.inkStrong, seed.bgApp, 4.5),
      importConfirm: readableOn(seed.ink, seed.surface, 4.5),
      chipActive: readableOn(mixHex(seed.inkStrong, seed.accent, dark ? 0.05 : 0.22), seed.accentSoft, 4.5),
      chipIdle: seed.inkMuted,
      miniPlay: ink(dark ? 0.15 : 0.22),
      displayIdle: mixHex(seed.inkMuted, seed.inkFaint, 0.35),
      profileMeta: mixHex(seed.inkSecondary, seed.inkMuted, 0.25),
      emptySearch: mixHex(seed.inkMuted, seed.inkSecondary, 0.2),
      historyIcon: mixHex(seed.inkFaint, seed.inkMuted, 0.45),
      songCount: mixHex(seed.inkFaint, seed.inkMuted, 0.2),
      suggestArrow: mixHex(seed.inkFaint, seed.inkMuted, 0.15),
      searching: mixHex(seed.inkMuted, seed.inkFaint, 0.25),
      heroArrow: mixHex(seed.inkFaint, seed.inkMuted, 0.3),
      index: mixHex(seed.inkMuted, seed.inkFaint, 0.2),
      rowMeta: mixHex(seed.inkMuted, seed.inkSecondary, 0.15),
      selection: mixHex(seed.inkSecondary, seed.inkMuted, 0.5),
      olive,
      pill: readableOn(mixHex(seed.inkStrong, seed.accent, 0.18), seed.accentSoft, 4.5),
      compact: readableOn(mixHex(seed.ink, seed.inkSecondary, 0.35), seed.bgApp, 4.5),
      heartIdle: mixHex(seed.inkMuted, seed.inkFaint, 0.4),
      onAccent: seed.accentOn,
    },
    accent: {
      primary: seed.accent,
      nav: seed.accentNav,
      chip: accentChip,
      soft: seed.accentSoft,
      thumbBorder: accentThumb,
      navShadow: accentShadow,
      highlight: accentHighlight,
      chipRipple: rgbaHex(seed.accentNav, 0.5),
    },
    danger: seed.danger,
    like: seed.like,
    control: {
      play,
      playShadow: dark ? mixHex(play, black, 0.35) : play,
      skip,
    },
    iconWrap: {
      orange: iconWrap('#f59e0b'),
      green: iconWrap('#10b981'),
      purple: iconWrap('#8b5cf6'),
      amber: iconWrap('#eab308'),
      red: iconWrap('#ef4444'),
    },
    badge: {
      online: olive,
      male: iconWrap('#3b82f6'),
      female: iconWrap('#ec4899'),
      unknown: dark ? mixHex(seed.divider, seed.surface, 0.4) : mixHex(seed.divider, paper, 0.35),
    },
    searchField: {
      border: seed.searchBorder,
    },
    glass: {
      fill08: rgbaHex(glassBase, 0.08),
      fill14: rgbaHex(glassBase, 0.14),
      fill26: rgbaHex(glassBase, 0.26),
      fill28: rgbaHex(glassBase, 0.28),
      fill30: rgbaHex(glassBase, 0.3),
      fill44: rgbaHex(glassBase, 0.44),
      fill52: rgbaHex(glassBase, 0.52),
      fill62: rgbaHex(glassBase, 0.62),
      fill70: rgbaHex(glassBase, 0.7),
      fill72: rgbaHex(glassBase, 0.72),
      fill78: rgbaHex(glassBase, 0.78),
      fill88: rgbaHex(glassBase, 0.88),
      fill90: rgbaHex(glassBase, 0.9),
      fill92: rgbaHex(glassBase, 0.92),
      fill95: rgbaHex(glassBase, 0.95),
      line16: rgbaHex(dark ? seed.inkFaint : paper, 0.16),
      line18: rgbaHex(dark ? seed.inkFaint : paper, 0.18),
      line45: rgbaHex(dark ? seed.ink : paper, 0.45),
      rim56: rgbaHex(rim, 0.56),
      rim58: rgbaHex(rim, 0.58),
      rim72: rgbaHex(rim, 0.72),
      rim72Warm: rgbaHex(rimWarm, 0.72),
      stroke: rgbaHex(line(dark ? 0.15 : 0.2), 0.92),
      backBorder: rgbaHex(line(dark ? 0.05 : 0.35), 0.96),
    },
    shadow: {
      ink: mixHex(seed.inkStrong, black, dark ? 0.2 : 0.25),
      card: mixHex(seed.inkMuted, black, 0.15),
      dock: mixHex(seed.inkMuted, seed.inkFaint, 0.2),
      dialog: dark ? black : seed.inkStrong,
      black,
      playGlass: mixHex(seed.inkStrong, black, 0.4),
      searchCard: mixHex(seed.inkStrong, seed.cover1, 0.35),
      segment: mixHex(seed.inkMuted, black, 0.1),
      softCard: mixHex(seed.inkMuted, seed.inkFaint, 0.15),
      menu: mixHex(seed.inkMuted, seed.inkSecondary, 0.2),
      hero: mixHex(shiftHue(seed.accent, 40), seed.inkMuted, 0.45),
    },
    scrim: {
      mask: black,
      settings: rgbaHex(scrim, 0.16),
      dialog: rgbaHex(dark ? black : scrim, dark ? 0.55 : 0.22),
      import: rgbaHex(dark ? black : scrim, dark ? 0.62 : 0.32),
      menu: rgbaHex(dark ? black : scrim, dark ? 0.66 : 0.35),
      wash: rgbaHex(scrim, dark ? 0.16 : 0.04),
      home: rgbaHex(scrim, dark ? 0.28 : 0.08),
      homeStrong: rgbaHex(scrim, dark ? 0.48 : 0.28),
      heroPhoto: rgbaHex(black, 0.45),
      lyricIdle: rgbaHex(scrim, dark ? 0.45 : 0.35),
      lyricHairline: rgbaHex(scrim, dark ? 0.16 : 0.04),
      lyricTrack: rgbaHex(scrim, dark ? 0.22 : 0.1),
      vinylRing: rgbaHex(scrim, dark ? 0.2 : 0.08),
      vinylInner: rgbaHex(scrim, dark ? 0.7 : 0.55),
    },
    line: {
      divider: seed.divider,
      soft: line(dark ? 0.15 : 0.35),
      hairline: line(dark ? 0.28 : 0.62),
      neutral: dark ? mixHex(seed.divider, seed.surfaceMuted, 0.4) : mixHex(seed.divider, paper, 0.45),
      prompt: line(dark ? 0.35 : 0.72),
      panel: line(dark ? 0.1 : 0.22),
      modal: line(dark ? 0.4 : 0.78),
      detail: line(dark ? 0.2 : 0.4),
      detailDisabled: line(dark ? 0.45 : 0.7),
      import: line(dark ? 0.12 : 0.28),
      searchEmpty: mixHex(seed.cover1, seed.divider, dark ? 0.45 : 0.35),
      segment: line(dark ? 0.18 : 0.32),
      segmentAlt: line(dark ? 0.22 : 0.25),
      importSelected: mixHex(seed.accent, seed.accentSoft, 0.45),
      thumb: mixHex(seed.surface, seed.divider, dark ? 0.35 : 0.25),
      white: dark ? seed.inkStrong : paper,
    },
    source: {
      tx,
      wy,
      kg,
      kw,
      mg,
      unknown: { text: seed.inkStrong, background: unknownBg },
      queueUnknown: { text: seed.inkStrong, background: queueUnknownBg },
      localPlayer,
      localDetail,
    },
    queue: {
      current: dark ? mixHex(kg.background, seed.surface, 0.35) : mixHex('#eff6ff', seed.bgApp, 0.35),
      close: dark ? mixHex(wy.background, seed.surface, 0.35) : mixHex('#fef2f2', seed.cover1, 0.4),
    },
    decor: {
      tonearmPivot: mixHex(seed.inkFaint, seed.divider, 0.4),
      tonearmArm: mixHex(seed.inkFaint, lift, 0.35),
      tonearmHead: mixHex(seed.inkMuted, seed.inkFaint, 0.4),
    },
    coverFallback: {
      top: mixHex(seed.cover1, seed.surface, dark ? 0.25 : 0.35),
      middle: mixHex(seed.cover1, seed.surface, dark ? 0.4 : 0.55),
      glow: mixHex(seed.cover1, seed.surface, dark ? 0.55 : 0.75),
      bottom: seed.surface,
      accent: readableOn(mixHex(seed.accent, seed.cover1, 0.35), seed.surface, 3),
    },
    homeCards: [0, 32, 168, 210].map(degrees => pastelCard(shiftHue(seed.accent, degrees), dark ? seed.surface : paper, seed.inkStrong, dark)),
    homeHeroes: [0, 140, 36].map(degrees => hero(
      shiftHue(seed.accent, degrees),
      dark ? mixHex(shiftHue(seed.accent, degrees), seed.surface, 0.7) : mixHex(shiftHue(seed.accent, degrees), paper, 0.78),
    )),
    playlistCovers: [
      swatch(readableOn(mixHex(seed.accent, seed.cover1, 0.4), seed.cover1, 3), seed.cover1, seed.inkStrong),
      swatch(readableOn(shiftHue(seed.accent, 28), mixHex(seed.cover1, seed.surfaceMuted, 0.4), 3), mixHex(seed.cover1, seed.surfaceMuted, 0.4), seed.inkStrong),
      swatch(readableOn(mixHex(seed.accent, seed.cover2, 0.45), seed.cover2, 3), seed.cover2, seed.inkStrong),
      swatch(readableOn(shiftHue(seed.accent, -24), mixHex(seed.cover2, seed.surface, 0.35), 3), mixHex(seed.cover2, seed.accentSoft, dark ? 0.45 : 0.25), seed.inkStrong),
    ],
  }

  if (contrastRatio(colors.ink.onAccent, colors.accent.primary) < 4.5) {
    colors.ink.onAccent = readableOn(colors.ink.onAccent, colors.accent.primary, 4.5)
  }
  if (contrastRatio(colors.ink.secondary, colors.bg.app) < 3) {
    colors.ink.secondary = readableOn(colors.ink.secondary, colors.bg.app, 3)
  }
  if (contrastRatio(colors.ink.strong, colors.bg.app) < 4.5) {
    colors.ink.strong = readableOn(colors.ink.strong, colors.bg.app, 4.5)
  }
  if (contrastRatio(colors.ink.list, colors.surface.card) < 4.5) {
    colors.ink.list = readableOn(colors.ink.list, colors.surface.card, 4.5)
  }
  return colors
}
