/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { contrastRatio, mixHex, relativeLuminance } from '../../theme/luxColorMath'
import { type MagazineRoles } from '../../theme/magazineRoles'

export type ReplayBlockId =
  | 'cover'
  | 'topSong'
  | 'topArtist'
  | 'topLists'
  | 'timeOfDay'
  | 'rhythm'
  | 'sources'
  | 'closing'

type TokenKey = 'paper' | 'accentSoft' | 'accent'

export type ReplayBgRecipe =
  | { kind: 'solid', token: TokenKey }
  | { kind: 'mix', from: TokenKey, to: TokenKey, amount: number }

/** P2 preview order: P, P→S 25/50/75, S, S→A 30/60, A. */
export const REPLAY_BG_RECIPES: Record<ReplayBlockId, ReplayBgRecipe> = {
  cover: { kind: 'solid', token: 'paper' },
  topSong: { kind: 'mix', from: 'paper', to: 'accentSoft', amount: 0.25 },
  topArtist: { kind: 'mix', from: 'paper', to: 'accentSoft', amount: 0.5 },
  topLists: { kind: 'mix', from: 'paper', to: 'accentSoft', amount: 0.75 },
  timeOfDay: { kind: 'solid', token: 'accentSoft' },
  rhythm: { kind: 'mix', from: 'accentSoft', to: 'accent', amount: 0.3 },
  sources: { kind: 'mix', from: 'accentSoft', to: 'accent', amount: 0.6 },
  closing: { kind: 'solid', token: 'accent' },
}

export const REPLAY_SEAM_HEIGHT = 140
export const REPLAY_SEAM_STOPS = 9
const MIN_TEXT_CONTRAST = 4.5
const MIN_CHART_CONTRAST = 3

const tokenColor = (roles: MagazineRoles, key: TokenKey): string => {
  if (key === 'paper') return roles.paper
  if (key === 'accentSoft') return roles.accentSoft
  return roles.accent
}

export const resolveRecipeBg = (roles: MagazineRoles, recipe: ReplayBgRecipe, amountOverride?: number): string => {
  if (recipe.kind === 'solid') return tokenColor(roles, recipe.token)
  const amount = amountOverride ?? recipe.amount
  return mixHex(tokenColor(roles, recipe.from), tokenColor(roles, recipe.to), amount)
}

const darkestText = (roles: MagazineRoles): string => (
  relativeLuminance(roles.ink) <= relativeLuminance(roles.display) ? roles.ink : roles.display
)

const lightestText = (roles: MagazineRoles): string => (
  relativeLuminance(roles.onInk) >= relativeLuminance(roles.onAccent) ? roles.onInk : roles.onAccent
)

/** Secondary = main mixed toward bg, kept ≥4.5:1. */
export const secondaryOnBg = (main: string, bg: string): string => {
  for (let amount = 0.42; amount >= 0; amount -= 0.03) {
    const candidate = mixHex(main, bg, amount)
    if (contrastRatio(candidate, bg) >= MIN_TEXT_CONTRAST) return candidate
  }
  return main
}

const pickMainText = (bg: string, roles: MagazineRoles): string => {
  const dark = darkestText(roles)
  const light = lightestText(roles)
  return contrastRatio(dark, bg) >= contrastRatio(light, bg) ? dark : light
}

const chartHighlight = (bg: string, roles: MagazineRoles, main: string): string => {
  if (contrastRatio(roles.accent, bg) >= MIN_CHART_CONTRAST) return roles.accent
  const soft = roles.accentSoft
  if (contrastRatio(soft, bg) >= contrastRatio(main, bg) && contrastRatio(soft, bg) >= MIN_CHART_CONTRAST) {
    return soft
  }
  return main
}

export interface ReplayBlockPalette {
  bg: string
  /** Final mix amount used (may be nudged from the recipe). */
  mixAmount: number | null
  display: string
  ink: string
  muted: string
  eyebrow: string
  faint: string
  bar: string
  barMuted: string
  barPeak: string
}

/**
 * Resolve block bg + text. If neither dark/light text hits 4.5:1, nudge the mix
 * amount by 5% steps (墨夜「分布」often lands at 25%).
 */
export const resolveReplayBlockPalette = (
  roles: MagazineRoles,
  blockId: ReplayBlockId,
): ReplayBlockPalette => {
  const recipe = REPLAY_BG_RECIPES[blockId]
  let mixAmount = recipe.kind === 'mix' ? recipe.amount : null
  let bg = resolveRecipeBg(roles, recipe, mixAmount ?? undefined)

  const contrastOk = (background: string) => {
    const dark = darkestText(roles)
    const light = lightestText(roles)
    return Math.max(contrastRatio(dark, background), contrastRatio(light, background)) >= MIN_TEXT_CONTRAST
  }

  if (recipe.kind === 'mix' && !contrastOk(bg)) {
    let bestAmount = recipe.amount
    let bestScore = Math.max(
      contrastRatio(darkestText(roles), bg),
      contrastRatio(lightestText(roles), bg),
    )
    for (let step = 1; step <= 12; step++) {
      for (const dir of [-1, 1]) {
        const next = Math.max(0, Math.min(1, recipe.amount + dir * step * 0.05))
        const nextBg = resolveRecipeBg(roles, recipe, next)
        const score = Math.max(
          contrastRatio(darkestText(roles), nextBg),
          contrastRatio(lightestText(roles), nextBg),
        )
        if (score > bestScore + 0.001) {
          bestScore = score
          bestAmount = next
        }
        if (score >= MIN_TEXT_CONTRAST) {
          mixAmount = next
          bg = nextBg
          break
        }
      }
      if (contrastOk(bg)) break
    }
    if (!contrastOk(bg)) {
      mixAmount = bestAmount
      bg = resolveRecipeBg(roles, recipe, bestAmount)
    }
  }

  const main = pickMainText(bg, roles)
  const muted = secondaryOnBg(main, bg)
  const barPeak = chartHighlight(bg, roles, main)
  const barMuted = mixHex(main, bg, 0.72)

  return {
    bg,
    mixAmount,
    display: main,
    ink: main,
    muted,
    eyebrow: muted,
    faint: muted,
    bar: main,
    barMuted,
    barPeak,
  }
}

/** Ease-in-out for seam stops (smoothstep). */
export const seamEase = (t: number): number => t * t * (3 - 2 * t)

export const buildSeamStops = (from: string, to: string, count = REPLAY_SEAM_STOPS): Array<{ offset: number, color: string }> => {
  const stops: Array<{ offset: number, color: string }> = []
  const n = Math.max(2, count)
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const eased = seamEase(t)
    stops.push({ offset: t, color: mixHex(from, to, eased) })
  }
  return stops
}
