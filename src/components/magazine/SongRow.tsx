/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { COVER_LIST, ROW_MIN_HEIGHT, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

import { Hairline } from './Hairline'
import { SourceTag } from './SourceTag'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    wrap: {
      position: 'relative',
    },
    playingMark: {
      position: 'absolute',
      left: -22,
      top: 0,
      bottom: 0,
      width: 3,
      backgroundColor: r.accent,
    },
    row: {
      minHeight: ROW_MIN_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      gap: 10,
    },
    index: {
      width: 30,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
    },
    cover: {
      width: COVER_LIST,
      height: COVER_LIST,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: r.placeholder,
    },
    coverImage: {
      width: COVER_LIST,
      height: COVER_LIST,
      borderRadius: 6,
    },
    text: {
      flex: 1,
      minWidth: 0,
    },
    title: {
      fontWeight: '700',
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 3,
    },
    duration: {
      fontWeight: '400',
      fontVariant: ['tabular-nums'],
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
  })
})

export const SongRow = memo(({
  index,
  title,
  subtitle,
  coverUri,
  source,
  sourceLabel,
  duration,
  playing = false,
  last = false,
  onPress,
  onMore,
  liked,
  onLike,
  trailing,
}: {
  index: number
  title: string
  subtitle?: string
  coverUri?: string | null
  source?: string
  sourceLabel?: string
  duration?: string
  playing?: boolean
  last?: boolean
  onPress?: () => void
  onMore?: () => void
  liked?: boolean
  onLike?: () => void
  trailing?: ReactNode
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const indexLabel = index < 10 ? `0${index}` : String(index)
  const body = (
    <View style={styles.wrap}>
      {playing ? <View style={styles.playingMark} /> : null}
      <View style={styles.row}>
        {playing
          ? <MdiIcon name="equalizer" size={18} color={r.accentInk} />
          : <Text size={magType.index.size} color={r.faint} style={styles.index}>{indexLabel}</Text>}
        <View style={styles.cover}>
          {coverUri ? <Image url={coverUri} style={styles.coverImage} /> : null}
        </View>
        <View style={styles.text}>
          <Text size={magType.rowTitle.size} color={r.ink} style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.metaRow}>
            {source && sourceLabel ? <SourceTag source={source} label={sourceLabel} /> : null}
            {subtitle
              ? <Text size={magType.meta.size} color={r.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{subtitle}</Text>
              : null}
          </View>
        </View>
        {duration
          ? <Text size={12} color={r.faint} style={styles.duration}>{duration}</Text>
          : null}
        <View style={styles.actions}>
          {onLike
            ? (
              <TouchableOpacity activeOpacity={0.7} onPress={onLike}>
                <MdiIcon name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? r.like : r.ink} />
              </TouchableOpacity>
              )
            : null}
          {onMore
            ? (
              <TouchableOpacity activeOpacity={0.7} onPress={onMore}>
                <MdiIcon name="dots-vertical" size={20} color={r.quiet} />
              </TouchableOpacity>
              )
            : null}
          {trailing}
        </View>
      </View>
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
