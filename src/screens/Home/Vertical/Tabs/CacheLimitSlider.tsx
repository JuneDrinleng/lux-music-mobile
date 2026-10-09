/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { memo } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { MagSlider } from '@/components/magazine/MagSlider'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { indexForCacheStep } from '@/utils/cacheLimitSteps'
import { createStyle } from '@/utils/tools'

/**
 * Cache ceiling row for settings. Track / thumb / ticks live in MagSlider
 * so tick x matches the thumb (§10.2). Title + status chip stay here.
 */

interface CacheLimitSliderProps {
  styles: Record<string, any>
  icon: string
  title: string
  steps: readonly number[]
  value: number
  formatTick: (step: number) => string
  formatChip: (step: number) => string
  onCommit: (step: number) => void
}

const useCacheLimitStyles = sharedLuxStyles((colors) => createStyle({
  titleRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingRight: 18,
    paddingBottom: 2,
    paddingLeft: 18,
  },
  titleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 8,
    minWidth: 0,
  },
  title: {
    marginBottom: 0,
    fontWeight: '700',
    lineHeight: 20,
  },
  chip: {
    height: 24,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.accent.soft,
    paddingHorizontal: 10,
  },
  chipText: {
    fontWeight: '700',
    includeFontPadding: false,
  },
  trackPad: {
    paddingTop: 4,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
}))

export const CacheLimitSlider = memo(({
  styles: parentStyles,
  icon,
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
          <View style={[parentStyles.groupRowIconWrap, parentStyles.iconWrapPurple]}>
            <MdiIcon name={icon} size={24} color={r.ink} />
          </View>
          <View style={parentStyles.groupRowTextWrap}>
            <Text size={15} color={r.list} style={localStyles.title}>{title}</Text>
          </View>
        </View>
        <View style={localStyles.chip}>
          <Text size={12} color={colors.ink.chipActive} style={localStyles.chipText}>{chipLabel}</Text>
        </View>
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
