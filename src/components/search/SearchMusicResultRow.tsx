/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { TouchableOpacity, View } from 'react-native'

import { MdiIcon } from '@/components/common/MdiIcon'
import Text from '@/components/common/Text'
import { Hairline, SourceTag } from '@/components/magazine'
import { useI18n, type Message } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { ROW_MIN_HEIGHT, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'
import HighlightText from './HighlightText'

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
  index,
  keyword,
  isLoved,
  last = false,
  onPress,
  onToggleLoved,
  onAdd,
}: {
  item: LX.Music.MusicInfoOnline
  index: number
  keyword: string
  isLoved: boolean
  last?: boolean
  onPress: () => void
  onToggleLoved: () => void
  onAdd: () => void
}) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()

  const indexLabel = index + 1 < 10 ? `0${index + 1}` : String(index + 1)
  const sourceLabel = t(sourceShortKey(item.source))
  const metaParts = [item.singer, item.meta?.albumName].filter(Boolean)
  const metaText = metaParts.join(' · ')

  return (
    <View>
      <View style={styles.songItem}>
        <TouchableOpacity
          style={styles.songMain}
          activeOpacity={0.7}
          onPress={onPress}
        >
          <Text size={magType.index.size} color={r.faint} style={styles.rankNum}>{indexLabel}</Text>
          <View style={styles.songInfo}>
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
              {metaText
                ? (
                  <HighlightText
                    text={metaText}
                    keyword={keyword}
                    size={magType.meta.size}
                    color={r.muted}
                    style={styles.metaText}
                    numberOfLines={1}
                  />
                  )
                : null}
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.searchSongActions}>
          <TouchableOpacity style={styles.songActionBtn} activeOpacity={0.7} onPress={onToggleLoved}>
            <MdiIcon name={isLoved ? 'heart' : 'heart-outline'} size={20} color={isLoved ? r.like : r.ink} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.songActionBtn} activeOpacity={0.7} onPress={onAdd}>
            <MdiIcon name="dots-vertical" size={20} color={r.quiet} />
          </TouchableOpacity>
        </View>
      </View>
      {last ? null : <Hairline />}
    </View>
  )
}

const useLuxStyles = sharedLuxStyles(() => (createStyle({
  songItem: {
    minHeight: ROW_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  songMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  rankNum: {
    width: 30,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  songInfo: {
    flex: 1,
    marginRight: 10,
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
  listTitle: {
    fontWeight: '700',
  },
  searchSongActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  songActionBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
})))
