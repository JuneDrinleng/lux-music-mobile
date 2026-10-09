/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { COVER_LIST, ROW_MIN_HEIGHT, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

import { Hairline } from './Hairline'
import { RankNumber } from './RankNumber'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    row: {
      minHeight: ROW_MIN_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
    },
    cover: {
      width: COVER_LIST,
      height: COVER_LIST,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: r.placeholder,
      marginLeft: 4,
    },
    coverImage: {
      width: COVER_LIST,
      height: COVER_LIST,
      borderRadius: 6,
    },
    text: {
      flex: 1,
      minWidth: 0,
      marginLeft: 12,
    },
    title: {
      fontWeight: '700',
    },
    sub: {
      marginTop: 3,
    },
    value: {
      fontWeight: '800',
      marginLeft: 10,
      fontVariant: ['tabular-nums'],
    },
    unit: {
      fontWeight: '600',
      marginLeft: 1,
    },
  })
})

export const RankedRow = memo(({
  rank,
  title,
  subtitle,
  coverUri,
  value,
  unit,
  last = false,
  onPress,
  trailing,
}: {
  rank: number
  title: string
  subtitle?: string
  coverUri?: string | null
  value?: string
  unit?: string
  last?: boolean
  onPress?: () => void
  trailing?: ReactNode
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const body = (
    <View style={styles.row}>
      <RankNumber rank={rank} />
      <View style={styles.cover}>
        {coverUri ? <Image url={coverUri} style={styles.coverImage} /> : null}
      </View>
      <View style={styles.text}>
        <Text size={magType.rowTitle.size} color={r.ink} style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle
          ? <Text size={magType.meta.size} color={r.muted} style={styles.sub} numberOfLines={1}>{subtitle}</Text>
          : null}
      </View>
      {trailing}
      {value
        ? (
          <Text size={magType.value.size} color={r.ink} style={styles.value}>
            {value}
            {unit
              ? <Text size={magType.valueUnit.size} color={r.muted} style={styles.unit}>{unit}</Text>
              : null}
          </Text>
          )
        : null}
    </View>
  )
  return (
    <View>
      {onPress
        ? <TouchableOpacity activeOpacity={0.7} onPress={onPress}>{body}</TouchableOpacity>
        : body}
      {last ? null : <Hairline />}
    </View>
  )
})
