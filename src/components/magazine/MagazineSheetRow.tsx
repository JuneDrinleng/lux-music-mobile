/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, SHEET_ROW_MIN_HEIGHT } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

import { Hairline } from './Hairline'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    wrap: {
      position: 'relative',
    },
    currentMark: {
      position: 'absolute',
      left: -PAGE_GUTTER,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: r.accent,
    },
    row: {
      minHeight: SHEET_ROW_MIN_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
    },
    cover: {
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: r.placeholder,
    },
    text: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontWeight: '700',
    },
    titleStrong: {
      fontWeight: '800',
    },
    sub: {
      marginTop: 2,
    },
    faint: {
      opacity: 0.55,
    },
  })
})

export const MagazineSheetRow = memo(({
  leading,
  coverUri,
  /** Pass 0 to hide the cover slot (add-to-playlist rows). Default 40. */
  coverSize = 40,
  title,
  subtitle,
  trailing,
  current = false,
  disabled = false,
  last = false,
  onPress,
}: {
  leading?: ReactNode
  coverUri?: string | null
  coverSize?: number
  title: string
  subtitle?: ReactNode
  trailing?: ReactNode
  current?: boolean
  disabled?: boolean
  last?: boolean
  onPress?: () => void
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const titleColor = disabled ? r.faint : r.ink
  const body = (
    <View style={[styles.wrap, disabled ? styles.faint : null]}>
      {current ? <View style={styles.currentMark} /> : null}
      <View style={styles.row}>
        {leading}
        {coverSize > 0
          ? (
            <View style={[styles.cover, { width: coverSize, height: coverSize }]}>
              {coverUri
                ? <Image url={coverUri} style={{ width: coverSize, height: coverSize, borderRadius: 6 }} />
                : null}
            </View>
            )
          : null}
        <View style={styles.text}>
          <Text
            size={15}
            color={titleColor}
            style={current ? styles.titleStrong : styles.title}
            numberOfLines={1}
          >{title}</Text>
          {subtitle
            ? (
                typeof subtitle === 'string'
                  ? <Text size={12} color={disabled ? r.faint : r.muted} style={styles.sub} numberOfLines={1}>{subtitle}</Text>
                  : <View style={styles.sub}>{subtitle}</View>
              )
            : null}
        </View>
        {trailing}
      </View>
    </View>
  )
  return (
    <View>
      {onPress
        ? (
          <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
            {body}
          </TouchableOpacity>
          )
        : body}
      {last ? null : <Hairline />}
    </View>
  )
})
