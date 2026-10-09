/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { TouchableOpacity, View } from 'react-native'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { Hairline, SourceTag } from '@/components/magazine'
import { useI18n, type Message } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'
import { type ListInfoItem as SearchSonglistItem } from '@/store/songlist/state'
import { createStyle } from '@/utils/tools'
import HighlightText from './HighlightText'

const COVER_SIZE = 56

const sourceShortKey = (source: string): keyof Message => {
  switch (source) {
    case 'kw': return 'source_short_kw'
    case 'kg': return 'source_short_kg'
    case 'tx': return 'source_short_tx'
    case 'wy': return 'source_short_wy'
    case 'mg': return 'source_short_mg'
    default: return `source_real_${source}` as keyof Message
  }
}

export default ({
  item,
  keyword,
  last = false,
  onPress,
}: {
  item: SearchSonglistItem
  keyword: string
  last?: boolean
  onPress: () => void
}) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()

  const sourceLabel = t(sourceShortKey(item.source))
  const totalLabel = item.total
    ? t('me_tracks_count', { num: item.total })
    : ''
  const metaLine = [item.author?.trim(), totalLabel].filter(Boolean).join(' · ')
  const playCount = item.play_count?.trim()

  return (
    <View>
      <TouchableOpacity
        style={styles.songlistItem}
        activeOpacity={0.7}
        onPress={onPress}
      >
        <View style={styles.cover}>
          <Image style={styles.songlistPic} url={item.img ?? null} />
        </View>
        <View style={styles.songlistInfo}>
          <HighlightText
            text={item.name}
            keyword={keyword}
            size={magType.rowTitle.size}
            color={r.ink}
            style={styles.listTitle}
            numberOfLines={1}
          />
          <View style={styles.songMetaRow}>
            <SourceTag source={item.source} label={sourceLabel} />
            {metaLine
              ? <Text size={magType.meta.size} color={r.muted} numberOfLines={1} style={styles.metaText}>{metaLine}</Text>
              : null}
          </View>
          {playCount
            ? (
              <View style={styles.playCountRow}>
                <MdiIcon name="play" size={12} color={r.faint} />
                <Text size={magType.meta.size} color={r.faint}>{playCount}</Text>
              </View>
              )
            : null}
        </View>
        <MdiIcon name="chevron-right" size={18} color={r.quiet} />
      </TouchableOpacity>
      {last ? null : <Hairline />}
    </View>
  )
}

const useLuxStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    songlistItem: {
      minHeight: 72,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      gap: 12,
    },
    cover: {
      width: COVER_SIZE,
      height: COVER_SIZE,
      borderRadius: 6,
      overflow: 'hidden',
      backgroundColor: r.placeholder,
    },
    songlistPic: {
      width: COVER_SIZE,
      height: COVER_SIZE,
      borderRadius: 6,
    },
    songlistInfo: {
      flex: 1,
      minWidth: 0,
    },
    songMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 3,
    },
    metaText: {
      flexShrink: 1,
    },
    playCountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    listTitle: {
      fontWeight: '700',
    },
  })
})
