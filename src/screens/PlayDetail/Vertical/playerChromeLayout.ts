/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Estimate the full text even while the button renders only a moon. Tabular digits
// keep the budget stable across ticks; longer custom timers reserve extra digits.
export const estimateTimerLabelWidth = (pill: string, fontSize: number) => (
  fontSize * (3.2 + Math.max(0, pill.length - 7) * 0.55)
)

export const shouldCompactSleepTimer = ({
  windowWidth,
  tabsWidth,
  fullPillWidth,
  shareWidth,
  gutter,
  minGap,
  active,
}: {
  windowWidth: number
  tabsWidth: number
  fullPillWidth: number
  shareWidth: number
  gutter: number
  minGap: number
  active: boolean
}) => active && windowWidth / 2 - tabsWidth / 2 < fullPillWidth + shareWidth + gutter + minGap
