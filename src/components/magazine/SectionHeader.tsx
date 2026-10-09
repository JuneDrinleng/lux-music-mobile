/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { TouchableOpacity, View, type ViewStyle } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { RULE_TO_SECTION, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

import { Rule } from './Rule'

const useStyles = sharedLuxStyles(() => createStyle({
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: RULE_TO_SECTION,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  meta: {
    fontWeight: '600',
    letterSpacing: 1,
  },
  link: {
    fontWeight: '700',
  },
}))

export const SectionHeader = memo(({
  title,
  meta,
  linkLabel,
  onLinkPress,
  showRule = true,
  compactRule = false,
  trailing,
  style,
}: {
  title: string
  meta?: string
  linkLabel?: string
  onLinkPress?: () => void
  showRule?: boolean
  compactRule?: boolean
  trailing?: ReactNode
  style?: ViewStyle
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <View style={style}>
      {showRule ? <Rule compact={compactRule} /> : null}
      <View style={styles.head}>
        <Text size={magType.section.size} color={r.display} style={styles.title}>{title}</Text>
        {trailing ?? (linkLabel != null
          ? (
            <TouchableOpacity activeOpacity={0.7} onPress={onLinkPress}>
              <Text size={magType.sectionMeta.size} color={r.ink} style={styles.link}>{linkLabel}</Text>
            </TouchableOpacity>
            )
          : meta != null
            ? <Text size={magType.sectionMeta.size} color={r.eyebrow} style={styles.meta}>{meta}</Text>
            : null)}
      </View>
    </View>
  )
})
