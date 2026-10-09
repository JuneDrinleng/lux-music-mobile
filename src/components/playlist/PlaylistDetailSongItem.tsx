/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Animated, TouchableOpacity, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import { MdiIcon } from '@/components/common/MdiIcon'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Checkbox, Hairline, ICON_BUTTON_SIZE, IconButton, MagMenu, SourceTag } from '@/components/magazine'
import { createStyle } from '@/utils/tools'
import { fetchAltCoverUrl } from '@/core/music/utils'
import { recordCoverFailure, clearCoverFailure } from '@/utils/coverFailureRegistry'
import { updateListMusics } from '@/core/list'
import { peekCachedImageUri } from '@/utils/imageCache'
import { peekPlaylistCover, subscribePlaylistCover, subscribePlaylistCoverStore } from '@/utils/playlistCoverStore'
import { playlistCoverKey, preferStableCover, resolvePlaylistRowCover } from '@/utils/playlistCoverMap'
import { isRetainedPlaylistSong, prioritizePlaylistCovers } from '@/utils/playlistCoverPrefetch'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { COVER_LIST, ROW_MIN_HEIGHT, magType } from '@/theme/magazineType'
import { useI18n } from '@/lang'

export const SONG_ITEM_HEIGHT = 70

interface PlaylistDetailSongItemProps {
  song: LX.Music.MusicInfo
  index: number
  shiftAnim: Animated.Value
  fallbackCover?: string | null
  listId?: string | null
  isGhost?: boolean
  canEdit?: boolean
  detailNote?: string | null
  selecting?: boolean
  selected?: boolean
  playing?: boolean
  last?: boolean
  sourceLabel?: string
  statusLabel?: string | null
  onLayout: (event: LayoutChangeEvent) => void
  onPress: () => void
  onDragPressIn?: (event: GestureResponderEvent) => void
  onRemove?: () => void
  trailing?: React.ReactNode
}

const PlaylistDetailSongItem = ({
  song,
  index,
  shiftAnim,
  fallbackCover = null,
  listId = null,
  isGhost = false,
  canEdit = false,
  detailNote = null,
  selecting = false,
  selected = false,
  playing = false,
  last = false,
  sourceLabel,
  statusLabel = null,
  onLayout,
  onPress,
  onDragPressIn,
  onRemove,
  trailing,
}: PlaylistDetailSongItemProps) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const rawSourceLabel = sourceLabel ?? (song.source === 'local' ? '' : t(`source_real_${song.source}`))
  const resolvedSourceLabel = rawSourceLabel
    ? rawSourceLabel.replace(/音乐$/, '').replace(/ Music$/i, '')
    : null

  const coverForSong = useCallback((currentSong: LX.Music.MusicInfo, fallback: string | null) => {
    const direct = currentSong.meta.picUrl?.trim() ?? ''
    if (currentSong.source == 'local' && direct && !/^https?:\/\//i.test(direct)) return direct
    return resolvePlaylistRowCover({
      source: currentSong.source,
      picUrl: currentSong.meta.picUrl,
      togglePicUrl: currentSong.meta.toggleMusicInfo?.meta.picUrl ?? null,
      fallbackUrl: fallback,
      mapped: peekPlaylistCover(currentSong.source, currentSong.id),
      isCached: (url) => peekCachedImageUri(url) != null,
    })
  }, [])

  const [displayCoverUrl, setDisplayCoverUrl] = useState<string | null>(() => coverForSong(song, fallbackCover))

  const publishCover = useCallback((currentSong: LX.Music.MusicInfo, fallback: string | null) => {
    const next = coverForSong(currentSong, fallback)
    setDisplayCoverUrl(current => preferStableCover(
      current,
      next,
      (url) => !/^https?:\/\//i.test(url) || peekCachedImageUri(url) != null,
    ))
  }, [coverForSong])

  useEffect(() => {
    publishCover(song, fallbackCover)
    const key = playlistCoverKey(song.source, song.id)
    const update = () => { publishCover(song, fallbackCover) }
    const unsubscribeCover = subscribePlaylistCover(key, update)
    const unsubscribeStore = subscribePlaylistCoverStore(update)
    return () => {
      unsubscribeCover()
      unsubscribeStore()
    }
  }, [fallbackCover, publishCover, song])

  useEffect(() => {
    if (song.source == 'local') return
    const mapped = peekPlaylistCover(song.source, song.id)
    if (mapped?.url) return
    if (song.meta.picUrl) return
    prioritizePlaylistCovers([song], 'visible')
  }, [song])

  const handleCoverError = useCallback(async(_url: string | number) => {
    const mapped = peekPlaylistCover(song.source, song.id)
    if (mapped && mapped.url != mapped.thumbUrl) {
      let promoted = false
      setDisplayCoverUrl(current => {
        if (current == mapped.thumbUrl) {
          promoted = true
          return mapped.url
        }
        return current
      })
      if (promoted) return
    }
    if (song.source === 'local') return
    const onlineSong = song
    const altUrl = await fetchAltCoverUrl(onlineSong)
    if (altUrl) {
      onlineSong.meta.picUrl = altUrl
      setDisplayCoverUrl(altUrl)
      void clearCoverFailure(onlineSong)
      if (listId) void updateListMusics([{ id: listId, musicInfo: onlineSong }])
    } else {
      void recordCoverFailure(onlineSong)
    }
  }, [song, listId])

  const moreRef = useRef<View>(null)
  const [moreMenuVisible, setMoreMenuVisible] = useState(false)
  const [moreMenuAnchor, setMoreMenuAnchor] = useState({ top: 0, left: 0 })

  const openMoreMenu = useCallback(() => {
    moreRef.current?.measureInWindow((x, y, _w, h) => {
      setMoreMenuAnchor({ top: y + h + 4, left: x })
      setMoreMenuVisible(true)
    })
  }, [])

  const indexLabel = index < 9 ? `0${index + 1}` : String(index + 1)
  const subtitle = detailNote ?? [song.singer, song.meta.albumName].filter(Boolean).join(' · ')

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      <Animated.View
        style={[
          isGhost ? styles.ghost : null,
          { transform: [{ translateY: shiftAnim }] },
        ]}
      >
        {playing && !selecting ? <View style={[styles.playingMark, { backgroundColor: r.accent }]} /> : null}
        <TouchableOpacity style={styles.row} activeOpacity={0.8} onPress={onPress}>
          {selecting
            ? <Checkbox checked={selected} />
            : playing
              ? <MdiIcon name="equalizer" size={18} color={r.accentInk} />
              : <Text size={magType.index.size} color={r.faint} style={styles.index}>{indexLabel}</Text>}
          <View style={[styles.cover, { backgroundColor: r.placeholder }]}>
            <Image
              style={styles.coverImage}
              url={displayCoverUrl}
              cachePin={song.source == 'local'
                ? /^https?:\/\//i.test(displayCoverUrl ?? '')
                : isRetainedPlaylistSong(song.source, song.id)}
              onError={handleCoverError}
            />
          </View>
          <View style={styles.info}>
            <Text size={magType.rowTitle.size} color={r.ink} style={styles.name} numberOfLines={1}>{song.name}</Text>
            <View style={styles.metaRow}>
              {resolvedSourceLabel && song.source !== 'local'
                ? <SourceTag source={song.source} label={resolvedSourceLabel} />
                : null}
              {subtitle
                ? <Text size={magType.meta.size} color={r.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{subtitle}</Text>
                : null}
            </View>
          </View>
          {statusLabel
            ? (
              <View style={[styles.statusChip, { borderColor: r.ink }]}>
                <Text size={11} color={r.ink} style={{ fontWeight: '600' }}>{statusLabel}</Text>
              </View>
              )
            : (
              <Text size={12} color={r.faint} style={styles.interval}>{song.interval ?? '--:--'}</Text>
              )}
          {trailing}
          {canEdit && !selecting && onRemove
            ? (
              <View ref={moreRef} collapsable={false}>
                <IconButton
                  name="dots-vertical"
                  size={20}
                  color={r.quiet}
                  accessibilityLabel={t('more_actions')}
                  onPress={openMoreMenu}
                />
              </View>
              )
            : null}
          {canEdit && !selecting
            ? (
              <TouchableOpacity
                style={styles.dragButton}
                activeOpacity={0.75}
                delayLongPress={0}
                onLongPress={onDragPressIn}
                accessibilityRole="button"
                accessibilityLabel={t('library_drag_sort')}
              >
                <MdiIcon name="drag-horizontal-variant" size={18} color={r.quiet} />
              </TouchableOpacity>
              )
            : null}
        </TouchableOpacity>
        {onRemove
          ? (
            <MagMenu
              visible={moreMenuVisible}
              onClose={() => { setMoreMenuVisible(false) }}
              anchor={moreMenuAnchor}
              items={[{ id: 'remove', label: t('list_remove') }]}
              onChange={(id) => {
                if (id === 'remove') onRemove()
              }}
            />
            )
          : null}
        {last ? null : <Hairline />}
      </Animated.View>
    </View>
  )
}

const useLuxStyles = sharedLuxStyles(() => createStyle({
  wrap: {
    position: 'relative',
  },
  ghost: {
    opacity: 0,
  },
  playingMark: {
    position: 'absolute',
    left: -22,
    top: 0,
    bottom: 0,
    width: 3,
    zIndex: 1,
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
  },
  coverImage: {
    width: COVER_LIST,
    height: COVER_LIST,
    borderRadius: 6,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  interval: {
    fontVariant: ['tabular-nums'],
    minWidth: 40,
    textAlign: 'right',
  },
  statusChip: {
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragButton: {
    width: ICON_BUTTON_SIZE,
    height: ICON_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
}))

export default memo(PlaylistDetailSongItem, (prev, next) => {
  return prev.song === next.song &&
    prev.index === next.index &&
    prev.shiftAnim === next.shiftAnim &&
    prev.fallbackCover === next.fallbackCover &&
    prev.listId === next.listId &&
    prev.isGhost === next.isGhost &&
    prev.canEdit === next.canEdit &&
    prev.detailNote === next.detailNote &&
    prev.selecting === next.selecting &&
    prev.selected === next.selected &&
    prev.playing === next.playing &&
    prev.last === next.last &&
    prev.sourceLabel === next.sourceLabel &&
    prev.statusLabel === next.statusLabel &&
    prev.onLayout === next.onLayout &&
    prev.onPress === next.onPress &&
    prev.onDragPressIn === next.onDragPressIn &&
    prev.onRemove === next.onRemove &&
    prev.trailing === next.trailing
})
