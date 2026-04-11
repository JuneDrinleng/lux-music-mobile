// Lux Proprietary
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  FlatList,
  TouchableOpacity,
  View,
} from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { APP_LAYER_INDEX, LIST_IDS } from '@/config/constant'
import { clearListMusics, getListMusics, removeListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { useI18n } from '@/lang'
import { useMyList } from '@/store/list/hook'
import {
  useIsPlay,
  usePlayInfo,
  usePlayerMusicInfo,
} from '@/store/player/hook'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import { useWindowSize } from '@/utils/hooks'
import { setSystemBarsTransparent } from '@/utils/nativeModules/utils'
import { confirmDialog, createStyle } from '@/utils/tools'

const QUEUE_ITEM_HEIGHT = 56
const QUEUE_LIST_TOP_PADDING = 4
const QUEUE_PANEL_MIN_HEIGHT = 300
const QUEUE_PANEL_MAX_HEIGHT_RATIO = 0.82
const QUEUE_PANEL_HEIGHT_RATIO = 0.62
const sourceTagColorMap: Record<string, { text: string, background: string }> = {
  tx: { text: '#31c27c', background: '#ecfdf3' },
  wy: { text: '#d81e06', background: '#fef2f2' },
  kg: { text: '#2f88ff', background: '#eff6ff' },
  kw: { text: '#f59e0b', background: '#fffbeb' },
  mg: { text: '#e11d8d', background: '#fdf2f8' },
}

const getSourceTagColor = (source: string) => {
  return sourceTagColorMap[source.toLowerCase()] ?? { text: '#111827', background: '#f3f4f6' }
}

export default memo(
  ({ systemGestureInsetBottom = 0, enabled = true }: { systemGestureInsetBottom?: number, enabled?: boolean }) => {
    const t = useI18n()
    const winSize = useWindowSize()
    const myLists = useMyList()
    const playInfo = usePlayInfo()
    const isPlay = useIsPlay()
    const musicInfo = usePlayerMusicInfo()
    const queueLoadId = useRef(0)
    const queueListRef = useRef<FlatList<LX.Music.MusicInfo>>(null)
    const queueInitialAlignedRef = useRef(false)
    const musicAddModalRef = useRef<MusicAddModalType>(null)
    const panelAnim = useRef(new Animated.Value(0)).current
    const [isVisible, setVisible] = useState(false)
    const [playQueue, setPlayQueue] = useState<LX.Music.MusicInfo[]>([])
    void systemGestureInsetBottom

    const isTempQueue = playInfo.playerListId == LIST_IDS.TEMP

    const panelBodyHeight = useMemo(() => {
      const targetHeight = Math.floor(winSize.height * QUEUE_PANEL_HEIGHT_RATIO)
      const maxHeight = Math.floor(winSize.height * QUEUE_PANEL_MAX_HEIGHT_RATIO)
      return Math.min(Math.max(QUEUE_PANEL_MIN_HEIGHT, targetHeight), maxHeight)
    }, [winSize.height])
    const panelTotalHeight = panelBodyHeight
    const panelTranslateY = panelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [panelTotalHeight, 0],
    })
    const maskOpacity = panelAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.22],
    })

    const loadPlayQueue = useCallback(
      async(targetListId?: string | null) => {
        const listId = targetListId ?? playInfo.playerListId
        if (!listId) {
          setPlayQueue([])
          return
        }
        const loadId = ++queueLoadId.current
        const list = await getListMusics(listId)
        if (queueLoadId.current != loadId) return
        setPlayQueue([...list])
      },
      [playInfo.playerListId],
    )

    useEffect(() => {
      void loadPlayQueue(playInfo.playerListId)
    }, [loadPlayQueue, playInfo.playerListId])

    useEffect(() => {
      const handleListUpdate = (ids: string[]) => {
        const currentListId = playInfo.playerListId
        if (!currentListId || !ids.includes(currentListId)) return
        void loadPlayQueue(currentListId)
      }
      global.app_event.on('myListMusicUpdate', handleListUpdate)
      return () => {
        global.app_event.off('myListMusicUpdate', handleListUpdate)
      }
    }, [loadPlayQueue, playInfo.playerListId])

    const hideQueuePanel = useCallback(() => {
      if (!isVisible) return
      panelAnim.stopAnimation()
      Animated.timing(panelAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return
        setVisible(false)
      })
    }, [isVisible, panelAnim])

    const showQueuePanel = useCallback(() => {
      if (!enabled) return
      if (isVisible) return
      queueInitialAlignedRef.current = false
      setSystemBarsTransparent()
      setVisible(true)
      panelAnim.stopAnimation()
      panelAnim.setValue(0)
      Animated.timing(panelAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start()
    }, [enabled, isVisible, panelAnim])

    const toggleQueuePanel = useCallback(() => {
      if (!enabled) return
      if (isVisible) hideQueuePanel()
      else showQueuePanel()
    }, [enabled, hideQueuePanel, isVisible, showQueuePanel])

    useEffect(() => {
      if (!enabled) return
      global.app_event.on('togglePlayQueuePanel', toggleQueuePanel)
      global.app_event.on('showPlayQueuePanel', showQueuePanel)
      global.app_event.on('hidePlayQueuePanel', hideQueuePanel)
      return () => {
        global.app_event.off('togglePlayQueuePanel', toggleQueuePanel)
        global.app_event.off('showPlayQueuePanel', showQueuePanel)
        global.app_event.off('hidePlayQueuePanel', hideQueuePanel)
      }
    }, [enabled, hideQueuePanel, showQueuePanel, toggleQueuePanel])

    useEffect(() => {
      if (enabled || !isVisible) return
      panelAnim.stopAnimation()
      panelAnim.setValue(0)
      setVisible(false)
    }, [enabled, isVisible, panelAnim])

    useEffect(() => {
      if (!enabled || !isVisible) return
      setSystemBarsTransparent()
    }, [enabled, isVisible])

    const queueTitle = useMemo(() => {
      const listId = playInfo.playerListId
      if (!listId) return t('player_bar_not_playing')
      switch (listId) {
        case LIST_IDS.DEFAULT:
          return t('list_name_default')
        case LIST_IDS.LOVE:
          return t('list_name_love')
        case LIST_IDS.TEMP:
          return t('list_name_temp')
      }
      return myLists.find((list) => list.id == listId)?.name ?? t('me_my_playlists')
    }, [myLists, playInfo.playerListId, t])

    const currentQueueIndex = useMemo(() => {
      if (!musicInfo.id || !playQueue.length) return -1
      let index = playQueue.findIndex(
        (item) => item.id == musicInfo.id && item.source == musicInfo.source,
      )
      if (index < 0) index = playQueue.findIndex((item) => item.id == musicInfo.id)
      return index
    }, [musicInfo.id, musicInfo.source, playQueue])

    const initialQueueAnchorIndex = useMemo(() => {
      if (!playQueue.length) return 0
      const byPlayInfo = playInfo.playerPlayIndex
      if (byPlayInfo >= 0 && byPlayInfo < playQueue.length) return byPlayInfo
      if (currentQueueIndex >= 0 && currentQueueIndex < playQueue.length) return currentQueueIndex
      return 0
    }, [currentQueueIndex, playInfo.playerPlayIndex, playQueue.length])

    useEffect(() => {
      if (!isVisible || !playQueue.length) return
      if (queueInitialAlignedRef.current) return
      const targetIndex = Math.min(
        Math.max(0, initialQueueAnchorIndex),
        playQueue.length - 1,
      )
      const timer = setTimeout(() => {
        queueListRef.current?.scrollToIndex({
          index: targetIndex,
          animated: false,
          viewPosition: 0.5,
        })
        queueInitialAlignedRef.current = true
      }, 0)
      return () => {
        clearTimeout(timer)
      }
    }, [initialQueueAnchorIndex, isVisible, playQueue.length])

    const handleSelectQueueMusic = useCallback(
      (index: number) => {
        const listId = playInfo.playerListId
        if (!listId || index < 0 || index >= playQueue.length) return
        if (index != playInfo.playerPlayIndex) void playList(listId, index)
      },
      [playInfo.playerListId, playInfo.playerPlayIndex, playQueue.length],
    )

    const handleRemoveQueueMusic = useCallback(
      async(id: string) => {
        const listId = playInfo.playerListId
        if (!listId) return
        if (listId != LIST_IDS.TEMP) return
        await removeListMusics(listId, [id])
        setPlayQueue((prev) => prev.filter((item) => item.id !== id))
      },
      [playInfo.playerListId],
    )
    const handleShowMusicAddModal = useCallback((musicInfo: LX.Music.MusicInfo) => {
      musicAddModalRef.current?.show({
        musicInfo,
        listId: '',
        isMove: false,
      })
    }, [])
    const handleClearQueue = useCallback(async() => {
      const listId = playInfo.playerListId
      if (!listId || !playQueue.length) return
      if (listId != LIST_IDS.TEMP) return
      const confirm = await confirmDialog({
        message: t('play_queue_clear_current_confirm'),
        cancelButtonText: t('cancel_button_text'),
        confirmButtonText: t('confirm_button_text'),
      })
      if (!confirm) return
      await clearListMusics([listId])
      setPlayQueue([])
      hideQueuePanel()
    }, [
      hideQueuePanel,
      playInfo.playerListId,
      playQueue.length,
      t,
    ])

    const renderQueueItem = useCallback(
      ({ item, index }: { item: LX.Music.MusicInfo, index: number }) => {
        const isCurrent = index == currentQueueIndex
        const sourceTagColor = getSourceTagColor(item.source)
        return (
          <View
            style={[
              styles.itemRow,
              isCurrent ? { backgroundColor: sourceTagColor.background } : null,
            ]}
          >
            <TouchableOpacity
              style={styles.itemPress}
              activeOpacity={0.8}
              onPress={() => {
                handleSelectQueueMusic(index)
              }}
            >
              <Text
                size={11}
                color={isCurrent ? sourceTagColor.text : '#9ca3af'}
                style={styles.itemIndex}
              >
                {`${index + 1}`.padStart(2, '0')}
              </Text>
              <View style={styles.itemMain}>
                <Text
                  size={13}
                  color={isCurrent ? sourceTagColor.text : '#111827'}
                  numberOfLines={1}
                  style={styles.itemTitle}
                >
                  {item.name}
                </Text>
                <View style={styles.itemMetaRow}>
                  <Text
                    size={10}
                    color={sourceTagColor.text}
                    style={[styles.itemSourceTag, { backgroundColor: sourceTagColor.background }]}
                  >
                    {item.source.toUpperCase()}
                  </Text>
                  <Text size={11} color="#6b7280" numberOfLines={1} style={styles.itemSinger}>
                    {item.singer || '-'}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
            <View style={styles.itemActions}>
              {isCurrent ? (
                <View style={styles.itemNowPlaying}>
                  <Icon
                    name={isPlay ? 'pause' : 'play'}
                    rawSize={14}
                    color={sourceTagColor.text}
                  />
                </View>
              ) : null}
              {isTempQueue ? (
                <>
                  <TouchableOpacity
                    style={styles.itemActionBtn}
                    activeOpacity={0.75}
                    onPress={() => {
                      handleShowMusicAddModal(item)
                    }}
                  >
                    <Icon name="add-music" rawSize={15} color="#6b7280" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.itemActionBtn}
                    activeOpacity={0.75}
                    onPress={() => {
                      void handleRemoveQueueMusic(item.id)
                    }}
                  >
                    <Icon name="remove" rawSize={15} color="#6b7280" />
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        )
      },
      [
        currentQueueIndex,
        handleShowMusicAddModal,
        handleRemoveQueueMusic,
        handleSelectQueueMusic,
        isTempQueue,
        isPlay,
      ],
    )

    if (!isVisible) return null

    return (
      <View pointerEvents="box-none" style={styles.overlayRoot}>
        <Animated.View
          style={[
            styles.mask,
            { opacity: maskOpacity },
          ]}
        >
          <TouchableOpacity
            style={styles.maskTouchable}
            activeOpacity={1}
            onPress={hideQueuePanel}
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.panelShadow,
            {
              height: panelTotalHeight,
              transform: [{ translateY: panelTranslateY }],
            },
          ]}
        >
          <View style={styles.panel}>
            <View style={styles.grabWrap}>
              <View style={styles.grab} />
            </View>
            <View style={styles.header}>
              <View style={styles.headerTitleWrap}>
                <Text size={14} color="#111827" style={styles.headerTitle}>
                  {queueTitle}
                </Text>
                <Text size={11} color="#6b7280">
                  {t('me_tracks_count', { num: playQueue.length })}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.closeBtn,
                  !isTempQueue || !playQueue.length ? styles.closeBtnDisabled : null,
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  void handleClearQueue()
                }}
                disabled={!isTempQueue || !playQueue.length}
              >
                <Text
                  size={12}
                  color={!isTempQueue || !playQueue.length ? '#9ca3af' : '#ef4444'}
                >
                  {t('play_queue_clear_current_btn')}
                </Text>
              </TouchableOpacity>
            </View>
            {playQueue.length ? (
              <FlatList
                ref={queueListRef}
                data={playQueue}
                renderItem={renderQueueItem}
                keyExtractor={(item, index) => `${item.id}_${index}`}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={8}
                getItemLayout={(data, index) => ({
                  length: QUEUE_ITEM_HEIGHT,
                  offset: QUEUE_ITEM_HEIGHT * index,
                  index,
                })}
                onScrollToIndexFailed={(info) => {
                  queueListRef.current?.scrollToOffset({
                    offset: Math.max(
                      0,
                      info.index * QUEUE_ITEM_HEIGHT + QUEUE_LIST_TOP_PADDING,
                    ),
                    animated: false,
                  })
                }}
              />
            ) : (
              <View style={styles.emptyWrap}>
                <Text size={12} color="#9ca3af">
                  {t('no_item')}
                </Text>
              </View>
            )}
          </View>
          <MusicAddModal ref={musicAddModalRef} />
        </Animated.View>
      </View>
    )
  },
)

const styles = createStyle({
  overlayRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: APP_LAYER_INDEX.playQueue,
    elevation: APP_LAYER_INDEX.playQueue,
  },
  mask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
  },
  maskTouchable: {
    flex: 1,
  },
  panelShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
  },
  panel: {
    flex: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  grabWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  grab: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
  },
  header: {
    minHeight: 52,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    flex: 1,
    marginRight: 10,
  },
  headerTitle: {
    fontWeight: '700',
    marginBottom: 1,
  },
  closeBtn: {
    height: 30,
    minWidth: 88,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    backgroundColor: '#fef2f2',
  },
  closeBtnDisabled: {
    backgroundColor: '#f3f4f6',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: QUEUE_LIST_TOP_PADDING,
    paddingBottom: 12,
  },
  itemRow: {
    height: QUEUE_ITEM_HEIGHT,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemRowCurrent: {
    backgroundColor: '#eff6ff',
  },
  itemPress: {
    flex: 1,
    minHeight: QUEUE_ITEM_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6,
  },
  itemIndex: {
    width: 26,
    textAlign: 'center',
    fontWeight: '600',
  },
  itemMain: {
    flex: 1,
    marginLeft: 8,
    minWidth: 0,
  },
  itemTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemSourceTag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    fontWeight: '700',
    marginRight: 6,
  },
  itemSinger: {
    flex: 1,
    minWidth: 0,
  },
  itemActions: {
    minWidth: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemNowPlaying: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemActionBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
