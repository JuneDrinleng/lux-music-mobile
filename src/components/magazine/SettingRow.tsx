/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { ICON_BLOCK, SETTING_ROW_MIN_HEIGHT, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

import { Hairline } from './Hairline'

const useStyles = sharedLuxStyles(() => createStyle({
  row: {
    minHeight: SETTING_ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  iconWrap: {
    width: ICON_BLOCK,
    height: ICON_BLOCK,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
  },
  value: {
    fontWeight: '600',
    marginRight: 4,
  },
  dangerTitle: {
    fontWeight: '700',
  },
}))

export const SettingRow = memo(({
  icon,
  iconBg,
  title,
  subtitle,
  value,
  onPress,
  danger = false,
  last = false,
  trailing,
}: {
  icon: string
  iconBg: string
  title: string
  subtitle?: string
  value?: string
  onPress?: () => void
  danger?: boolean
  last?: boolean
  trailing?: ReactNode
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const body = (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <MdiIcon name={icon} size={18} color={r.ink} />
      </View>
      <View style={styles.text}>
        <Text
          size={magType.rowTitle.size}
          color={danger ? r.danger : r.list}
          style={danger ? styles.dangerTitle : styles.title}
          numberOfLines={1}
        >{title}</Text>
        {subtitle
          ? <Text size={magType.meta.size} color={r.muted} style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          : null}
      </View>
      {trailing}
      {value
        ? <Text size={13} color={r.muted} style={styles.value} numberOfLines={1}>{value}</Text>
        : null}
      {onPress && !trailing
        ? <MdiIcon name="chevron-right" size={18} color={r.quiet} />
        : null}
    </View>
  )
  return (
    <View>
      {onPress
        ? (
          <TouchableOpacity activeOpacity={0.7} onPress={onPress} accessibilityRole="button">
            {body}
          </TouchableOpacity>
          )
        : body}
      {last ? null : <Hairline />}
    </View>
  )
})
