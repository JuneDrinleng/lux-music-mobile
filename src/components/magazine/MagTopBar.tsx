/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { View, type ViewStyle } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { TOP_BAR_MARGIN_TOP, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

import { BackButton } from './BackButton'
import { Hairline } from './Hairline'

const useStyles = sharedLuxStyles(() => createStyle({
  bar: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: TOP_BAR_MARGIN_TOP,
  },
  left: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  masthead: {
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  stickyTitle: {
    fontWeight: '800',
  },
}))

export const MagTopBar = memo(({
  masthead,
  stickyTitle,
  showStickyTitle = false,
  showHairline = false,
  onBack,
  backIcon = 'chevron-left',
  leading,
  trailing,
  style,
}: {
  masthead?: string
  stickyTitle?: string
  showStickyTitle?: boolean
  showHairline?: boolean
  onBack?: () => void
  backIcon?: 'chevron-left' | 'chevron-down'
  leading?: ReactNode
  trailing?: ReactNode
  style?: ViewStyle
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <View>
      <View style={[styles.bar, style]}>
        <View style={styles.left}>
          {onBack ? <BackButton onPress={onBack} icon={backIcon} /> : null}
          {leading}
          {showStickyTitle && stickyTitle
            ? <Text size={15} color={r.display} style={styles.stickyTitle} numberOfLines={1}>{stickyTitle}</Text>
            : masthead
              ? <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.masthead} numberOfLines={1}>{masthead}</Text>
              : null}
        </View>
        {trailing ? <View style={styles.right}>{trailing}</View> : null}
      </View>
      {showHairline ? <Hairline /> : null}
    </View>
  )
})
