/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type LuxColors } from './luxTokens'

/**
 * Magazine design role aliases onto existing LuxColors slots.
 * Pure aliases — no new color values. Default lime theme stays byte-identical.
 * See docs/design-system-magazine.md §3.1 / §8.2.
 */
export const magazineRoles = (c: LuxColors) => ({
  paper: c.bg.app,
  paperRaised: c.bg.plain,
  display: c.ink.pageTitle,
  ink: c.ink.strong,
  list: c.ink.list,
  muted: c.ink.secondary,
  eyebrow: c.ink.eyebrow,
  option: c.ink.option,
  faint: c.ink.faint,
  quiet: c.ink.quiet,
  hairline: c.line.divider,
  accent: c.accent.primary,
  accentSoft: c.accent.soft,
  onAccent: c.ink.onAccent,
  accentInk: c.ink.olive,
  onInk: c.ink.onControl,
  danger: c.danger,
  like: c.like,
  placeholder: c.surface.placeholder,
  skeleton: c.surface.skeleton,
  scrim: c.scrim.import,
  iconWrap: c.iconWrap,
  surface: c.surface.card,
})

export type MagazineRoles = ReturnType<typeof magazineRoles>
