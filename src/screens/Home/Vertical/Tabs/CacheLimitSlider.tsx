/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { MagSlider, StatusChip } from '@/components/magazine'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { ICON_BLOCK } from '@/theme/magazineType'
import { indexForCacheStep } from '@/utils/cacheLimitSteps'
import { createStyle } from '@/utils/tools'

/**
 * Cache ceiling row for settings. Track / thumb / ticks live in MagSlider
 * so tick x matches the thumb. Title + status chip stay here.
 */

interface CacheLimitSliderProps {
  /** @deprecated unused — kept for call-site compatibility during migration */
  styles?: Record<string, unknown>
  icon: string
  iconBg?: string
  title: string
  steps: readonly number[]
  value: number
  formatTick: (step: number) => string
  formatChip: (step: number) => string
  onCommit: (step: number) => void
}

const useCacheLimitStyles = sharedLuxStyles(() => createStyle({
  titleRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  titleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  iconWrap: {
    width: ICON_BLOCK,
    height: ICON_BLOCK,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '700',
  },
  trackPad: {
    paddingTop: 2,
    paddingBottom: 12,
  },
}))

export const CacheLimitSlider = memo(({
  icon,
  iconBg,
  title,
  steps,
  value,
  formatTick,
  formatChip,
  onCommit,
}: CacheLimitSliderProps) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const localStyles = useCacheLimitStyles()
  const activeIndex = indexForCacheStep(steps, value)
  const displayStep = steps[activeIndex] ?? steps[0] ?? 0
  const chipLabel = formatChip(displayStep)

  return (
    <>
      <View style={localStyles.titleRow}>
        <View style={localStyles.titleLeft}>
          <View style={[localStyles.iconWrap, { backgroundColor: iconBg ?? r.iconWrap.purple }]}>
            <MdiIcon name={icon} size={18} color={r.ink} />
          </View>
          <Text size={16} color={r.list} style={localStyles.title}>{title}</Text>
        </View>
        <StatusChip label={chipLabel} />
      </View>
      <View style={localStyles.trackPad}>
        <MagSlider
          steps={steps}
          value={value}
          formatTick={formatTick}
          formatValue={formatChip}
          onCommit={onCommit}
          accessibilityLabel={title}
        />
      </View>
    </>
  )
})
