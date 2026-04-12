import { type ReactElement, type RefObject } from 'react'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { Animated, FlatList, View, type LayoutChangeEvent, type ListRenderItem, type PanResponderInstance } from 'react-native'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import styles from './styles'
import { type SourceTagTone } from './types'

export interface PlaylistSongListProps {
  detailListRef: RefObject<FlatList<LX.Music.MusicInfo>>
  detailListWrapRef: RefObject<View>
  panHandlers: PanResponderInstance['panHandlers']
  songs: LX.Music.MusicInfo[]
  renderSongItem: ListRenderItem<LX.Music.MusicInfo>
  getSongRowKey: (item: LX.Music.MusicInfo, index: number) => string
  header: ReactElement | null
  emptyText: string
  bottomDockHeight: number
  isSongDragActive: boolean
  onWrapLayout: (event: LayoutChangeEvent) => void
  onScroll: (...args: any[]) => void
  onContentSizeChange: (width: number, height: number) => void
  draggingSong: LX.Music.MusicInfo | null
  draggingSourceTone?: SourceTagTone | null
  dragTop: Animated.Value
  dragScale: Animated.Value
  dragOpacity: Animated.Value
}

export default ({
  detailListRef,
  detailListWrapRef,
  panHandlers,
  songs,
  renderSongItem,
  getSongRowKey,
  header,
  emptyText,
  bottomDockHeight,
  isSongDragActive,
  onWrapLayout,
  onScroll,
  onContentSizeChange,
  draggingSong,
  draggingSourceTone,
  dragTop,
  dragScale,
  dragOpacity,
}: PlaylistSongListProps) => {
  return (
    <View
      ref={detailListWrapRef}
      style={styles.detailListWrap}
      onLayout={onWrapLayout}
      collapsable={false}
      {...panHandlers}
    >
      <FlatList
        ref={detailListRef}
        style={styles.container}
        contentContainerStyle={[styles.detailContent, { paddingBottom: bottomDockHeight }]}
        data={songs}
        renderItem={renderSongItem}
        keyExtractor={getSongRowKey}
        ListHeaderComponent={header}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Text size={13} color="#6b7280">{emptyText}</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={isSongDragActive ? 4 : 6}
        maxToRenderPerBatch={isSongDragActive ? 6 : 8}
        updateCellsBatchingPeriod={isSongDragActive ? 24 : 16}
        removeClippedSubviews={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        onScroll={onScroll}
        onContentSizeChange={onContentSizeChange}
        scrollEventThrottle={16}
        scrollEnabled={!isSongDragActive}
      />
      {draggingSong
        ? <Animated.View
            pointerEvents="none"
            style={[
              styles.songDragOverlay,
              {
                transform: [{ translateY: dragTop }, { scale: dragScale }],
                opacity: dragOpacity,
              },
            ]}
          >
            <View style={[styles.songItem, styles.songDragCard]}>
              <View style={styles.songMain}>
                <Image style={styles.songPic} url={draggingSong.meta.picUrl ?? null} />
                <View style={styles.songInfo}>
                  <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{draggingSong.name}</Text>
                  <View style={styles.songMetaRow}>
                    <Text
                      size={10}
                      color={draggingSourceTone?.text ?? '#111827'}
                      style={[styles.songSource, { backgroundColor: draggingSourceTone?.background ?? '#e5e7eb' }]}
                    >
                      {draggingSong.source.toUpperCase()}
                    </Text>
                    <Text size={11} color="#6b7280" numberOfLines={1}>{draggingSong.singer}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.songActions}>
                <Text size={11} color="#9ca3af" style={styles.songInterval}>{draggingSong.interval ?? '--:--'}</Text>
                <View style={styles.songActionBtn}>
                  <MaterialCommunityIcon name="drag-horizontal-variant" size={16} color="#6b7280" />
                </View>
              </View>
            </View>
          </Animated.View>
        : null}
    </View>
  )
}
