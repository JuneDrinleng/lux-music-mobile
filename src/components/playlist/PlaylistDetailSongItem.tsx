import { memo, useCallback, useEffect, useState } from 'react'
import { Animated, TouchableOpacity, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { MdiIcon } from '@/components/common/MdiIcon'

import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { fetchAltCoverUrl } from '@/core/music/utils'
import { recordCoverFailure, clearCoverFailure } from '@/utils/coverFailureRegistry'
import { updateListMusics } from '@/core/list'
import { peekCachedImageUri } from '@/utils/imageCache'
import { peekPlaylistCover, subscribePlaylistCover, subscribePlaylistCoverStore } from '@/utils/playlistCoverStore'
import { playlistCoverKey, preferStableCover, resolvePlaylistRowCover } from '@/utils/playlistCoverMap'
import { isRetainedPlaylistSong, prioritizePlaylistCovers } from '@/utils/playlistCoverPrefetch'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'

export const SONG_ITEM_HEIGHT = 70

interface SourceTone {
  text: string
  background: string
}

interface PlaylistDetailSongItemProps {
  song: LX.Music.MusicInfo
  sourceTone: SourceTone
  shiftAnim: Animated.Value
  fallbackCover?: string | null
  listId?: string | null
  isGhost?: boolean
  canEdit?: boolean
  onLayout: (event: LayoutChangeEvent) => void
  onPress: () => void
  onDragPressIn?: (event: GestureResponderEvent) => void
  onRemove?: () => void
}

const PlaylistDetailSongItem = ({
  song,
  sourceTone,
  shiftAnim,
  fallbackCover = null,
  listId = null,
  isGhost = false,
  canEdit = false,
  onLayout,
  onPress,
  onDragPressIn,
  onRemove,
}: PlaylistDetailSongItemProps) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()

  const coverForSong = useCallback((currentSong: LX.Music.MusicInfo, fallback: string | null) => {
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

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      <Animated.View
        style={[
          styles.card,
          isGhost ? styles.ghostCard : null,
          { transform: [{ translateY: shiftAnim }] },
        ]}
      >
        <TouchableOpacity
          style={styles.main}
          activeOpacity={0.8}
          onPress={onPress}
        >
          <Image
            style={styles.cover}
            url={displayCoverUrl}
            cachePin={song.source != 'local' && isRetainedPlaylistSong(song.source, song.id)}
            onError={handleCoverError}
          />
          <View style={styles.info}>
            <Text size={14} color={colors.ink.strong} style={styles.name} numberOfLines={1}>{song.name}</Text>
            <View style={styles.metaRow}>
              <Text size={10} color={sourceTone.text} style={[styles.sourceBadge, { backgroundColor: sourceTone.background }]}>
                {song.source.toUpperCase()}
              </Text>
              <Text size={11} color={colors.ink.meta} numberOfLines={1}>{song.singer}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.actions}>
          <Text size={11} color={colors.ink.faint} style={styles.interval}>{song.interval ?? '--:--'}</Text>
          {canEdit
            ? (
                <>
                  <TouchableOpacity style={styles.actionButton} activeOpacity={0.75} onPress={onRemove}>
                    <MaterialCommunityIcon name="trash-can" size={16} color={colors.ink.faint} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dragButton}
                    activeOpacity={0.75}
                    delayLongPress={0}
                    onLongPress={onDragPressIn}
                  >
                    <MdiIcon name="drag-horizontal-variant" size={16} color={colors.ink.nearBlack} />
                  </TouchableOpacity>
                </>
              )
            : null}
        </View>
      </Animated.View>
    </View>
  )
}

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  wrap: {
    position: 'relative',
  },
  card: {
    borderRadius: 14,
    backgroundColor: colors.bg.app,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  ghostCard: {
    opacity: 0,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cover: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.surface.neutral,
  },
  info: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  name: {
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sourceBadge: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontWeight: '600',
    marginRight: 6,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  interval: {
    marginRight: 4,
    minWidth: 40,
    textAlign: 'right',
  },
  dragButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },
  dragIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain',
  },
  actionButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
})))

export default memo(PlaylistDetailSongItem, (prev, next) => {
  return prev.song === next.song &&
    prev.sourceTone === next.sourceTone &&
    prev.shiftAnim === next.shiftAnim &&
    prev.fallbackCover === next.fallbackCover &&
    prev.listId === next.listId &&
    prev.isGhost === next.isGhost &&
    prev.canEdit === next.canEdit &&
    prev.onLayout === next.onLayout &&
    prev.onPress === next.onPress &&
    prev.onDragPressIn === next.onDragPressIn &&
    prev.onRemove === next.onRemove
})
