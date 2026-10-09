/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, View } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import {
  IconButton,
  MagazineSheet,
  MagazineSheetRow,
  SourceTag,
} from '@/components/magazine'
import { LIST_IDS } from '@/config/constant'
import { clearListMusics, getListMusics, removeListMusics } from '@/core/list'
import { playList } from '@/core/player/player'
import { useI18n } from '@/lang'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import { useMyList } from '@/store/list/hook'
import {
  useIsPlay,
  usePlayInfo,
  usePlayerMusicInfo,
} from '@/store/player/hook'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { setSystemBarsTransparent } from '@/utils/nativeModules/utils'
import { pickMusicCover } from '@/utils/musicCover'
import { confirmDialog } from '@/utils/tools'

const QUEUE_ITEM_HEIGHT = 56
const QUEUE_PANEL_HEIGHT_RATIO = 0.62

const pad2 = (value: number) => (value < 10 ? `0${value}` : String(value))

export default memo(
  ({ systemGestureInsetBottom = 0, enabled = true }: { systemGestureInsetBottom?: number, enabled?: boolean }) => {
    const { colors } = useLuxTheme()
    const r = magazineRoles(colors)
    const t = useI18n()
    const myLists = useMyList()
    const playInfo = usePlayInfo()
    const isPlay = useIsPlay()
    const musicInfo = usePlayerMusicInfo()
    const queueLoadId = useRef(0)
    const queueListRef = useRef<FlatList<LX.Music.MusicInfo>>(null)
    const queueInitialAlignedRef = useRef(false)
    const musicAddModalRef = useRef<MusicAddModalType>(null)
    const [isVisible, setVisible] = useState(false)
    const [playQueue, setPlayQueue] = useState<LX.Music.MusicInfo[]>([])
    void systemGestureInsetBottom

    const isTempQueue = playInfo.playerListId == LIST_IDS.TEMP

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
      setVisible(false)
    }, [isVisible])

    const showQueuePanel = useCallback(() => {
      if (!enabled) return
      if (isVisible) return
      queueInitialAlignedRef.current = false
      setSystemBarsTransparent()
      setVisible(true)
    }, [enabled, isVisible])

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
      setVisible(false)
    }, [enabled, isVisible])

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
    const handleShowMusicAddModal = useCallback((info: LX.Music.MusicInfo) => {
      musicAddModalRef.current?.show({
        musicInfo: info,
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

    const playingNum = currentQueueIndex >= 0 ? pad2(currentQueueIndex + 1) : '--'
    const eyebrow = t('sheet_queue_eyebrow', { num: playingNum })

    const renderQueueItem = useCallback(
      ({ item, index }: { item: LX.Music.MusicInfo, index: number }) => {
        const isCurrent = index == currentQueueIndex
        const sourceLabel = item.source !== 'local' ? item.source.toUpperCase() : ''
        return (
          <MagazineSheetRow
            coverUri={pickMusicCover(item)}
            coverSize={36}
            title={item.name}
            current={isCurrent}
            last={index >= playQueue.length - 1}
            onPress={() => { handleSelectQueueMusic(index) }}
            leading={
              <Text
                size={13}
                color={r.faint}
                style={{ width: 28, fontWeight: '700', fontVariant: ['tabular-nums'] }}
              >
                {pad2(index + 1)}
              </Text>
            }
            subtitle={
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {sourceLabel
                  ? <SourceTag source={item.source} label={sourceLabel} />
                  : null}
                <Text size={12} color={r.muted} numberOfLines={1}>{item.singer || '-'}</Text>
              </View>
            }
            trailing={
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isCurrent
                  ? (
                    <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                      <MdiIcon
                        name={isPlay ? 'pause' : 'play'}
                        size={18}
                        color={r.accentInk}
                      />
                    </View>
                    )
                  : null}
                {isTempQueue
                  ? (
                    <>
                      <IconButton
                        name="playlist-plus"
                        size={20}
                        color={r.muted}
                        accessibilityLabel={t('list_add_title_first_add')}
                        onPress={() => { handleShowMusicAddModal(item) }}
                      />
                      <IconButton
                        name="close"
                        size={20}
                        color={r.muted}
                        accessibilityLabel={t('list_remove')}
                        onPress={() => { void handleRemoveQueueMusic(item.id) }}
                      />
                    </>
                    )
                  : null}
              </View>
            }
          />
        )
      },
      [
        currentQueueIndex,
        handleShowMusicAddModal,
        handleRemoveQueueMusic,
        handleSelectQueueMusic,
        isTempQueue,
        isPlay,
        playQueue.length,
        r.accentInk,
        r.faint,
        r.muted,
        t,
      ],
    )

    return (
      <>
        <MagazineSheet
          visible={isVisible}
          onClose={hideQueuePanel}
          heightRatio={QUEUE_PANEL_HEIGHT_RATIO}
          eyebrow={eyebrow}
          title={queueTitle}
          meta={t('me_tracks_count', { num: playQueue.length })}
          figure={playQueue.length
            ? { value: String(playQueue.length), unit: t('library_tracks_unit') }
            : undefined}
          headerAction={{
            text: t('play_queue_clear_current_btn'),
            tone: 'danger',
            disabled: !isTempQueue || !playQueue.length,
            onPress: () => { void handleClearQueue() },
          }}
          empty={{ text: t('no_item'), eyebrow: 'EMPTY' }}
        >
          {playQueue.length
            ? (
              <FlatList
                ref={queueListRef}
                data={playQueue}
                renderItem={renderQueueItem}
                keyExtractor={(item, index) => `${item.id}_${index}`}
                showsVerticalScrollIndicator={false}
                initialNumToRender={20}
                maxToRenderPerBatch={20}
                windowSize={8}
                getItemLayout={(_data, index) => ({
                  length: QUEUE_ITEM_HEIGHT,
                  offset: QUEUE_ITEM_HEIGHT * index,
                  index,
                })}
                onScrollToIndexFailed={(info) => {
                  queueListRef.current?.scrollToOffset({
                    offset: Math.max(0, info.index * QUEUE_ITEM_HEIGHT),
                    animated: false,
                  })
                }}
              />
              )
            : null}
        </MagazineSheet>
        <MusicAddModal ref={musicAddModalRef} />
      </>
    )
  },
)
