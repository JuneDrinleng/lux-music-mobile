/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/**
 * Compact MagSegmented layout (library grid|list, chart toggle).
 * Visual height stays short; ≥44pt touch comes from hitSlop only.
 */

export const MAG_SEGMENTED_COMPACT = {
  /** Design-number visual height of the control (375 baseline). */
  visualHeight: 28,
  borderWidth: 1,
  paddingHorizontal: 10,
  paddingVertical: 0,
  labelSize: 12,
  iconSize: 14,
  gap: 4,
  /** Expand each cell's touch target to ≥44 without growing the painted box. */
  hitSlop: { top: 8, bottom: 8, left: 4, right: 4 },
  /** Must stay auto — flex:1's leftover flexBasis:0 collapses labels. */
  cellFlex: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto' as const,
  },
} as const

export const magSegmentedCompactHitHeight = (): number => (
  MAG_SEGMENTED_COMPACT.visualHeight +
  MAG_SEGMENTED_COMPACT.hitSlop.top +
  MAG_SEGMENTED_COMPACT.hitSlop.bottom
)
