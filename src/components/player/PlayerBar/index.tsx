import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, FlatList, Modal as RNModal, Platform, TouchableOpacity, View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { useKeyboard, useWindowSize } from '@/utils/hooks'
import { createStyle, toast } from '@/utils/tools'
import { scaleSizeW } from '@/utils/pixelRatio'
import Image from '@/components/common/Image'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useIsPlay, usePlayInfo, usePlayMusicInfo, usePlayerMusicInfo, useProgress } from '@/store/player/hook'
import { collectMusic, playList, togglePlay, uncollectMusic } from '@/core/player/player'
import { getListMusics, removeListMusics, setTempList } from '@/core/list'
import { useSettingValue } from '@/store/setting/hook'
import commonState from '@/store/common/state'
import { navigations } from '@/navigation'
import { APP_LAYER_INDEX, LIST_IDS } from '@/config/constant'
import { useI18n } from '@/lang'
import { useMyList } from '@/store/list/hook'
import { sortListMusicInfo } from '@/screens/Home/Views/Mylist/MyList/utils'
import { getListDetailAll } from '@/core/songlist'
import listState from '@/store/list/state'

const COVER_SIZE = 44
const RING_BORDER_WIDTH_RAW = 3.5
const COVER_INNER_SIZE = COVER_SIZE - RING_BORDER_WIDTH_RAW * 2
const RING_RENDER_SIZE = scaleSizeW(COVER_SIZE)
const RING_BORDER_WIDTH = scaleSizeW(RING_BORDER_WIDTH_RAW)
const CIRCLE_CENTER = RING_RENDER_SIZE / 2
const RING_RADIUS = (RING_RENDER_SIZE - RING_BORDER_WIDTH) / 2
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

const sourceRingColorMap: Record<string, string> = {
  tx: '#31c27c',
  wy: '#d81e06',
  kg: '#2f88ff',
  kw: '#f59e0b',
  mg: '#e11d8d',
  local: '#64748b',
}
const sourceTagColorMap: Record<string, { text: string, background: string }> = {
  tx: { text: '#31c27c', background: '#ecfdf3' },
  wy: { text: '#d81e06', background: '#fef2f2' },
  kg: { text: '#2f88ff', background: '#eff6ff' },
  kw: { text: '#f59e0b', background: '#fffbeb' },
  mg: { text: '#e11d8d', background: '#fdf2f8' },
  local: { text: '#475569', background: '#f1f5f9' },
  bd: { text: '#111827', background: '#e5e7eb' },
}

const SOURCE_RING_LIGHTEN_RATIO = 0.22
const ONLINE_SOURCES = new Set(['kw', 'kg', 'wy', 'tx', 'mg', 'bd'])
const QUEUE_ITEM_HEIGHT = 50
const QUEUE_LIST_BOTTOM_PADDING = 8
const QUEUE_PANEL_RADIUS = 18
const SYSTEM_GESTURE_BG_FALLBACK_HEIGHT = 48

const lightenHex = (hex: string, ratio: number) => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!match) return hex
  const value = match[1]
  const channel = (offset: number) => {
    const raw = parseInt(value.slice(offset, offset + 2), 16)
    const mixed = Math.round(raw + (255 - raw) * ratio)
    return mixed.toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

const getSourceColor = (source: string | null | undefined) => {
  const baseColor = !source ? '#111827' : (sourceRingColorMap[source.toLowerCase()] ?? '#111827')
  return lightenHex(baseColor, SOURCE_RING_LIGHTEN_RATIO)
}

const getTrackColor = (hex: string) => {
  if (/^#[0-9a-f]{6}$/i.test(hex)) return `${hex}33`
  return '#e5e7eb'
}
const getSourceTagColor = (source: string | null | undefined) => {
  if (!source) return { text: '#111827', background: '#e5e7eb' }
  return sourceTagColorMap[source.toLowerCase()] ?? { text: '#111827', background: '#e5e7eb' }
}

const getMusicSource = (musicInfo: LX.Player.PlayMusicInfo['musicInfo'] | null | undefined) => {
  if (!musicInfo) return null
  if ('progress' in musicInfo) return musicInfo.metadata.musicInfo.source
  return musicInfo.source
}

export default memo(({ isHome = false, systemGestureInsetBottom = 0 }: { isHome?: boolean, systemGestureInsetBottom?: number }) => {
  const t = useI18n()
  const { keyboardShown } = useKeyboard()
  const winSize = useWindowSize()
  const autoHidePlayBar = useSettingValue('common.autoHidePlayBar')
  const musicInfo = usePlayerMusicInfo()
  const playMusicInfo = usePlayMusicInfo()
  const playInfo = usePlayInfo()
  const myLists = useMyList()
  const { progress } = useProgress()
  const isPlay = useIsPlay()
  const loveCheckId = useRef(0)
  const queueLoadId = useRef(0)
  const queueListRef = useRef<FlatList<LX.Music.MusicInfo>>(null)
  const queueListViewportHeightRef = useRef(0)
  const queueAutoCenterPendingRef = useRef(false)
  const queuePanelAnim = useRef(new Animated.Value(0)).current
  const tempListFetchId = useRef('')
  const tempListLoadingRef = useRef(false)
  const [isLoved, setIsLoved] = useState(false)
  const [playQueue, setPlayQueue] = useState<LX.Music.MusicInfo[]>([])
  const [isQueuePanelVisible, setIsQueuePanelVisible] = useState(false)
  const ringColor = useMemo(() => {
    if (!musicInfo.id) return '#111827'
    return getSourceColor(getMusicSource(playMusicInfo.musicInfo))
  }, [musicInfo.id, playMusicInfo.musicInfo])
  const trackColor = useMemo(() => getTrackColor(ringColor), [ringColor])
  const normalizedProgress = useMemo(() => {
    if (!musicInfo.id || !Number.isFinite(progress)) return 0
    if (progress <= 0) return 0
    if (progress >= 1) return 1
    return progress
  }, [musicInfo.id, progress])
  const progressStrokeOffset = useMemo(() => {
    return RING_CIRCUMFERENCE * (1 - normalizedProgress)
  }, [normalizedProgress])
  const queuePanelHeight = useMemo(() => {
    return Math.max(220, Math.floor(winSize.height / 3))
  }, [winSize.height])
  const queueListBottomPadding = useMemo(() => {
    return QUEUE_LIST_BOTTOM_PADDING
  }, [])
  const queuePanelOpacity = queuePanelAnim
  const queuePanelTranslateY = queuePanelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [queuePanelHeight, 0],
  })
  const queueMaskOpacity = queuePanelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0],
  })
  const queueSystemGestureBgHeight = useMemo(() => {
    if (Platform.OS == 'android') return Math.max(systemGestureInsetBottom, SYSTEM_GESTURE_BG_FALLBACK_HEIGHT)
    if (systemGestureInsetBottom > 0) return systemGestureInsetBottom
    return 0
  }, [systemGestureInsetBottom])
  const queueMaskBottom = useMemo(() => {
    return Math.max(0, queuePanelHeight - QUEUE_PANEL_RADIUS + queueSystemGestureBgHeight)
  }, [queuePanelHeight, queueSystemGestureBgHeight])

  const showPlayDetail = () => {
    if (!musicInfo.id) return
    if (isQueuePanelVisible) {
      setIsQueuePanelVisible(false)
      queuePanelAnim.setValue(0)
    }
    navigations.pushPlayDetailScreen(commonState.componentIds.home!)
  }

  const refreshLovedState = useCallback(async(targetId?: string | null) => {
    const musicId = targetId ?? musicInfo.id
    if (!musicId) {
      setIsLoved(false)
      return
    }
    const musicIdStr = String(musicId)
    const currentCheckId = ++loveCheckId.current
    const loveList = await getListMusics(LIST_IDS.LOVE)
    if (currentCheckId !== loveCheckId.current) return
    setIsLoved(loveList.some(song => String(song.id) === musicIdStr))
  }, [musicInfo.id])

  useEffect(() => {
    void refreshLovedState(musicInfo.id)
  }, [musicInfo.id, refreshLovedState])

  useEffect(() => {
    const handleLoveListChanged = (ids: string[]) => {
      if (!ids.includes(LIST_IDS.LOVE)) return
      void refreshLovedState()
    }
    global.app_event.on('myListMusicUpdate', handleLoveListChanged)
    return () => {
      global.app_event.off('myListMusicUpdate', handleLoveListChanged)
    }
  }, [refreshLovedState])

  const handleToggleLoved = () => {
    if (!musicInfo.id) return
    const nextLoved = !isLoved
    setIsLoved(nextLoved)
    if (nextLoved) collectMusic()
    else uncollectMusic()
  }

  const loadPlayQueue = useCallback(async(targetListId?: string | null) => {
    const listId = targetListId ?? playInfo.playerListId
    if (!listId) {
      setPlayQueue([])
      return
    }
    const loadId = ++queueLoadId.current
    const list = await getListMusics(listId)
    if (queueLoadId.current != loadId) return
    setPlayQueue([...list])
  }, [playInfo.playerListId])

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
    if (!isQueuePanelVisible) return
    queueAutoCenterPendingRef.current = false
    queuePanelAnim.stopAnimation()
    Animated.timing(queuePanelAnim, {
      toValue: 0,
      duration: 230,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return
      setIsQueuePanelVisible(false)
    })
  }, [isQueuePanelVisible, queuePanelAnim])

  const showQueuePanel = useCallback(() => {
    if (isQueuePanelVisible) return
    queueAutoCenterPendingRef.current = true
    queueListViewportHeightRef.current = 0
    setIsQueuePanelVisible(true)
    queuePanelAnim.stopAnimation()
    queuePanelAnim.setValue(0)
    Animated.spring(queuePanelAnim, {
      toValue: 1,
      damping: 20,
      mass: 1,
      stiffness: 180,
      useNativeDriver: true,
    }).start()
  }, [isQueuePanelVisible, queuePanelAnim])

  const toggleQueuePanel = useCallback(() => {
    if (isQueuePanelVisible) hideQueuePanel()
    else showQueuePanel()
  }, [hideQueuePanel, isQueuePanelVisible, showQueuePanel])

  useEffect(() => {
    global.app_event.on('togglePlayQueuePanel', toggleQueuePanel)
    global.app_event.on('showPlayQueuePanel', showQueuePanel)
    global.app_event.on('hidePlayQueuePanel', hideQueuePanel)
    return () => {
      global.app_event.off('togglePlayQueuePanel', toggleQueuePanel)
      global.app_event.off('showPlayQueuePanel', showQueuePanel)
      global.app_event.off('hidePlayQueuePanel', hideQueuePanel)
    }
  }, [hideQueuePanel, showQueuePanel, toggleQueuePanel])

  const handleSelectQueueMusic = useCallback((index: number) => {
    const listId = playInfo.playerListId
    if (!listId || index < 0 || index >= playQueue.length) return
    if (index != playInfo.playerPlayIndex) {
      void playList(listId, index)
    }
  }, [playInfo.playerListId, playInfo.playerPlayIndex, playQueue.length])

  useEffect(() => {
    if (playInfo.playerListId) return
    if (isQueuePanelVisible) hideQueuePanel()
  }, [hideQueuePanel, isQueuePanelVisible, playInfo.playerListId])

  useEffect(() => {
    if (!isQueuePanelVisible || playInfo.playerListId != LIST_IDS.TEMP) return
    const tempMetaId = listState.tempListMeta.id
    if (!tempMetaId || tempMetaId == tempListFetchId.current || tempListLoadingRef.current) return

    const splitIndex = tempMetaId.indexOf('__')
    if (splitIndex < 1) return
    const source = tempMetaId.slice(0, splitIndex)
    const sourceListId = tempMetaId.slice(splitIndex + 2)
    if (!sourceListId || !ONLINE_SOURCES.has(source)) return

    tempListLoadingRef.current = true
    void getListDetailAll(source as LX.OnlineSource, sourceListId).then(async(fullList) => {
      if (!fullList.length) return
      if (listState.tempListMeta.id != tempMetaId) return
      if (fullList.length <= playQueue.length) {
        tempListFetchId.current = tempMetaId
        return
      }
      await setTempList(tempMetaId, [...fullList])
      tempListFetchId.current = tempMetaId
    }).finally(() => {
      tempListLoadingRef.current = false
    })
  }, [isQueuePanelVisible, playInfo.playerListId, playQueue.length])

  const queueTitle = useMemo(() => {
    const listId = playInfo.playerListId
    if (!listId) return t('player_bar_not_playing')
    const getListTitle = (id: string) => {
      switch (id) {
        case LIST_IDS.DEFAULT:
          return t('list_name_default')
        case LIST_IDS.LOVE:
          return t('list_name_love')
        case LIST_IDS.TEMP:
          return t('list_name_temp')
      }
      return myLists.find(list => list.id == id)?.name ?? t('me_my_playlists')
    }
    switch (listId) {
      case LIST_IDS.DEFAULT:
        return getListTitle(LIST_IDS.DEFAULT)
      case LIST_IDS.LOVE:
        return getListTitle(LIST_IDS.LOVE)
      case LIST_IDS.TEMP: {
        const tempMetaId = listState.tempListMeta.id
        if (tempMetaId.startsWith('queue__')) {
          const parts = tempMetaId.split('__')
          if (parts.length >= 3 && parts[1]) return getListTitle(parts[1])
        }
        return getListTitle(LIST_IDS.TEMP)
      }
    }
    return getListTitle(listId)
  }, [myLists, playInfo.playerListId, t])
  const currentQueueIndex = useMemo(() => {
    if (!musicInfo.id || !playQueue.length) return -1
    return playQueue.findIndex(item => item.id == musicInfo.id)
  }, [musicInfo.id, playQueue])

  const handleRemoveQueueMusic = useCallback(async(id: string) => {
    const listId = playInfo.playerListId
    if (!listId) return
    await removeListMusics(listId, [id])
    setPlayQueue(prev => prev.filter(item => item.id !== id))
  }, [playInfo.playerListId])

  const handleSortQueue = useCallback(async(type: 'up' | 'down' | 'random') => {
    const listId = playInfo.playerListId
    if (!listId || playQueue.length < 2) return
    const sortedList = sortListMusicInfo([...playQueue], type, 'name', global.i18n.locale)
    const currentMusicId = musicInfo.id
    let nextPlayIndex = currentMusicId ? sortedList.findIndex(item => item.id == currentMusicId) : -1
    if (nextPlayIndex < 0) {
      nextPlayIndex = Math.min(Math.max(0, playInfo.playerPlayIndex), sortedList.length - 1)
    }
    const queueMetaId = `queue__${listId}__${Date.now()}`
    await setTempList(queueMetaId, sortedList)
    setPlayQueue(sortedList)
    const wasPlaying = isPlay
    await playList(LIST_IDS.TEMP, nextPlayIndex)
    if (!wasPlaying) togglePlay()
    toast(type == 'random' ? t('list_sort_modal_by_random') : `${t('list_sort_modal_by_name')} ${type == 'up' ? '^' : 'v'}`)
  }, [isPlay, musicInfo.id, playInfo.playerListId, playInfo.playerPlayIndex, playQueue, t])

  const handleQueueScrollToIndexFailed = useCallback((info: { index: number, averageItemLength: number }) => {
    const estimatedLength = Math.max(44, info.averageItemLength || QUEUE_ITEM_HEIGHT)
    const estimatedViewport = Math.max(180, queuePanelHeight - 132)
    queueListRef.current?.scrollToOffset({
      offset: Math.max(0, info.index * estimatedLength - estimatedViewport / 2 + estimatedLength / 2),
      animated: false,
    })
    setTimeout(() => {
      queueListRef.current?.scrollToIndex({
        index: info.index,
        animated: false,
        viewPosition: 0.5,
      })
    }, 60)
  }, [queuePanelHeight])

  const scrollQueueToCurrent = useCallback(() => {
    if (!queueAutoCenterPendingRef.current) return
    if (!isQueuePanelVisible || currentQueueIndex < 0) return
    const viewportHeight = queueListViewportHeightRef.current
    if (viewportHeight <= 0) return
    const contentHeight = playQueue.length * QUEUE_ITEM_HEIGHT + queueListBottomPadding
    const maxOffset = Math.max(0, contentHeight - viewportHeight)
    const rawOffset = currentQueueIndex * QUEUE_ITEM_HEIGHT - (viewportHeight - QUEUE_ITEM_HEIGHT) / 2
    const offset = Math.min(maxOffset, Math.max(0, rawOffset))
    queueListRef.current?.scrollToOffset({ offset, animated: false })
    queueAutoCenterPendingRef.current = false
  }, [currentQueueIndex, isQueuePanelVisible, playQueue.length, queueListBottomPadding])

  const handleQueueListLayout = useCallback(({ nativeEvent }: { nativeEvent: { layout: { height: number } } }) => {
    queueListViewportHeightRef.current = nativeEvent.layout.height
    scrollQueueToCurrent()
  }, [scrollQueueToCurrent])

  useEffect(() => {
    if (!isQueuePanelVisible) return
    const timer = setTimeout(scrollQueueToCurrent, 120)
    return () => {
      clearTimeout(timer)
    }
  }, [isQueuePanelVisible, scrollQueueToCurrent])

  const renderQueueItem = useCallback(({ item, index }: { item: LX.Music.MusicInfo, index: number }) => {
    const isCurrent = index == currentQueueIndex
    const sourceTagColor = getSourceTagColor(item.source)
    return (
      <TouchableOpacity
        activeOpacity={0.82}
        style={[styles.queueItem, isCurrent ? [styles.queueItemActive, { borderLeftColor: ringColor }] : null]}
        onPress={() => { handleSelectQueueMusic(index) }}
      >
        <Text size={11} color={isCurrent ? ringColor : '#9ca3af'} style={styles.queueIndex}>
          {`${index + 1}`.padStart(2, '0')}
        </Text>
        <View style={styles.queueMain}>
          <Text size={12} color={isCurrent ? ringColor : '#374151'} numberOfLines={1} style={styles.queueName}>
            {item.name}
          </Text>
          <View style={styles.queueMetaRow}>
            <Text
              size={9}
              color={sourceTagColor.text}
              style={[styles.queueSourceTag, { backgroundColor: sourceTagColor.background }]}
            >
              {(item.source || 'unknown').toUpperCase()}
            </Text>
            <Text size={10} color={isCurrent ? '#475569' : '#9ca3af'} numberOfLines={1} style={styles.queueSinger}>
              {item.singer}
            </Text>
          </View>
        </View>
        {isCurrent
          ? <View style={[styles.queueActionIconBtn, styles.queuePlayIndicator]}>
              <Icon name={isPlay ? 'pause' : 'play'} rawSize={15} color="#111827" />
            </View>
          : null}
        <TouchableOpacity style={styles.queueActionIconBtn} activeOpacity={0.75} onPress={() => { void handleRemoveQueueMusic(item.id) }}>
          <Icon name='remove' rawSize={15} color='#111827' />
        </TouchableOpacity>
      </TouchableOpacity>
    )
  }, [currentQueueIndex, handleRemoveQueueMusic, handleSelectQueueMusic, isPlay, ringColor])

  const keepPlayBarOnKeyboard = Reflect.get(global.lx, 'keepPlayBarOnKeyboard') === true
  if (autoHidePlayBar && keyboardShown && !keepPlayBarOnKeyboard) return null

  return (
    <>
      <View style={[styles.wrap, isHome ? styles.wrapHome : styles.wrapFloat]}>
        <View style={styles.container}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.contentPress}
            onPress={showPlayDetail}
            onLongPress={isHome ? global.app_event.jumpListPosition : undefined}
          >
            <View style={styles.left}>
              <View style={styles.ring}>
                <View style={styles.coverClip}>
                  <Image url={musicInfo.pic} style={styles.pic} />
                </View>
                <Svg width={RING_RENDER_SIZE} height={RING_RENDER_SIZE} style={styles.ringSvg} pointerEvents="none">
                  <Circle
                    cx={CIRCLE_CENTER}
                    cy={CIRCLE_CENTER}
                    r={RING_RADIUS}
                    stroke={trackColor}
                    strokeWidth={RING_BORDER_WIDTH}
                    fill="none"
                  />
                  <Circle
                    cx={CIRCLE_CENTER}
                    cy={CIRCLE_CENTER}
                    r={RING_RADIUS}
                    stroke={ringColor}
                    strokeWidth={RING_BORDER_WIDTH}
                    fill="none"
                    strokeDasharray={`${RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
                    strokeDashoffset={progressStrokeOffset}
                    transform={`rotate(-90 ${CIRCLE_CENTER} ${CIRCLE_CENTER})`}
                    opacity={normalizedProgress > 0 ? 1 : 0}
                  />
                </Svg>
              </View>
            </View>
            <View style={styles.center}>
              <Text size={13} color="#111827" numberOfLines={1} style={styles.title}>
                {musicInfo.name || t('player_bar_not_playing')}
              </Text>
              <Text size={10} color="#6b7280" numberOfLines={1}>
                {musicInfo.singer || t('player_bar_choose_song')}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.iconBtn} activeOpacity={0.8} onPress={handleToggleLoved}>
              {isLoved
                ? <Text size={18} color="#ef4444" style={styles.loveFilled}>{'\u2665'}</Text>
                : <Icon name="love" rawSize={18} color="#9ca3af" />}
            </TouchableOpacity>
            <TouchableOpacity style={styles.playBtn} activeOpacity={0.85} onPress={togglePlay}>
              <Icon name={isPlay ? 'pause' : 'play'} rawSize={18} color="#ffffff" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, isQueuePanelVisible ? styles.iconBtnActive : null]} activeOpacity={0.8} onPress={toggleQueuePanel}>
              <Icon name="menu" rawSize={18} color={isQueuePanelVisible ? '#111827' : '#9ca3af'} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <RNModal
        transparent={true}
        visible={isQueuePanelVisible}
        presentationStyle="overFullScreen"
        animationType="none"
        hardwareAccelerated={true}
        statusBarTranslucent={true}
        navigationBarTranslucent={true}
        onRequestClose={hideQueuePanel}
      >
        <Animated.View style={[styles.modalMask, { opacity: queueMaskOpacity, bottom: queueMaskBottom }]}>
          <TouchableOpacity style={styles.queueMaskTouchable} activeOpacity={1} onPress={hideQueuePanel} />
        </Animated.View>
        <View pointerEvents="none" style={[styles.queueSystemGestureBg, { height: queueSystemGestureBgHeight }]} />
        <Animated.View style={[
          styles.queuePanel,
          {
            height: queuePanelHeight,
            opacity: queuePanelOpacity,
            transform: [
              { translateY: queuePanelTranslateY },
            ],
          },
        ]}
        >
          <View style={styles.queueHeader}>
            <Text size={13} color="#111827" style={styles.queueTitle}>{queueTitle}</Text>
            <Text size={10} color="#9ca3af">{t('me_tracks_count', { num: playQueue.length })}</Text>
          </View>
          <View style={styles.queueActionRow}>
            <TouchableOpacity style={styles.queueActionBtn} activeOpacity={0.78} onPress={() => { void handleSortQueue('up') }}>
              <Text size={11} color="#1f2937">{`${t('list_sort_modal_by_name')} ^`}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.queueActionBtn} activeOpacity={0.78} onPress={() => { void handleSortQueue('down') }}>
              <Text size={11} color="#1f2937">{`${t('list_sort_modal_by_name')} v`}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.queueActionBtn} activeOpacity={0.78} onPress={() => { void handleSortQueue('random') }}>
              <Text size={11} color="#1f2937">{t('list_sort_modal_by_random')}</Text>
            </TouchableOpacity>
          </View>
          {playQueue.length ? (
            <FlatList
              ref={queueListRef}
              data={playQueue}
              renderItem={renderQueueItem}
              keyExtractor={(item, index) => `${item.id}_${index}`}
              style={styles.queueList}
              contentContainerStyle={[styles.queueListContent, { paddingBottom: queueListBottomPadding }]}
              showsVerticalScrollIndicator={false}
              initialNumToRender={24}
              maxToRenderPerBatch={24}
              windowSize={9}
              getItemLayout={(data, index) => ({ length: QUEUE_ITEM_HEIGHT, offset: QUEUE_ITEM_HEIGHT * index, index })}
              onLayout={handleQueueListLayout}
              onContentSizeChange={scrollQueueToCurrent}
              onScrollToIndexFailed={handleQueueScrollToIndexFailed}
            />
          ) : (
            <View style={styles.queueEmpty}>
              <Text size={12} color="#9ca3af">{t('no_item')}</Text>
            </View>
          )}
        </Animated.View>
      </RNModal>
    </>
  )
})

const styles = createStyle({
  wrap: {
    paddingHorizontal: 12,
    paddingBottom: 6,
  },
  wrapHome: {
    marginTop: 0,
  },
  wrapFloat: {
    marginTop: -12,
  },
  container: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e8e8ec',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  contentPress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: {
    marginRight: 10,
  },
  ring: {
    width: COVER_SIZE,
    height: COVER_SIZE,
    borderRadius: scaleSizeW(COVER_SIZE / 2),
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverClip: {
    width: COVER_INNER_SIZE,
    height: COVER_INNER_SIZE,
    borderRadius: scaleSizeW(COVER_INNER_SIZE / 2),
    overflow: 'hidden',
  },
  pic: {
    width: '100%',
    height: '100%',
    borderRadius: scaleSizeW(COVER_INNER_SIZE / 2),
  },
  ringSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  center: {
    flex: 1,
    paddingRight: 6,
  },
  title: {
    fontWeight: '700',
    marginBottom: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  iconBtnActive: {
    backgroundColor: '#f3f4f6',
  },
  loveFilled: {
    lineHeight: 19,
    fontWeight: '700',
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 2,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  queueMask: {
    flex: 1,
  },
  queueMaskTouchable: {
    flex: 1,
  },
  modalMask: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
  },
  queueSystemGestureBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 0,
    backgroundColor: '#ffffff',
  },
  queuePanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: APP_LAYER_INDEX.playQueue,
    elevation: APP_LAYER_INDEX.playQueue,
    borderTopLeftRadius: QUEUE_PANEL_RADIUS,
    borderTopRightRadius: QUEUE_PANEL_RADIUS,
    borderTopWidth: 1,
    borderColor: '#e8e8ec',
    backgroundColor: 'rgba(255,255,255,1)',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -3 },
    overflow: 'hidden',
  },
  queueHeader: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  queueActionRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  queueActionBtn: {
    height: 30,
    borderRadius: 15,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    backgroundColor: '#f3f4f6',
  },
  queueTitle: {
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  queueList: {
    flex: 1,
  },
  queueListContent: {
    paddingVertical: 4,
    paddingBottom: 8,
  },
  queueItem: {
    height: 50,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueItemActive: {
    backgroundColor: '#eef6ff',
    borderLeftWidth: 3,
  },
  queueIndex: {
    width: 26,
    textAlign: 'center',
    fontWeight: '600',
  },
  queueMain: {
    flex: 1,
    marginHorizontal: 8,
    minWidth: 0,
    paddingRight: 8,
  },
  queueName: {
    fontWeight: '600',
    marginBottom: 1,
  },
  queueMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  queueSourceTag: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
    fontWeight: '600',
  },
  queueSinger: {
    flex: 1,
  },
  queueActionIconBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queuePlayIndicator: {
    marginRight: 6,
  },
  queueEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
