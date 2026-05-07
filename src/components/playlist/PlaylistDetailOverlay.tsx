import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image as RNImage,
  InteractionManager,
  Platform,
  StyleSheet,
  View,
  type ListRenderItem,
} from 'react-native'

import MusicMultiAddModal, { type MusicMultiAddModalType } from '@/components/MusicMultiAddModal'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import Text from '@/components/common/Text'
import { LIST_IDS } from '@/config/constant'
import { getListMusics, removeListMusics, removeUserList, setActiveList, setTempList, updateUserList } from '@/core/list'
import { playList, playListAsQueue } from '@/core/player/player'
import { getListDetailAll } from '@/core/songlist'
import { getListDetailAll as getLeaderboardListDetailAll } from '@/core/leaderboard'
import { type PlaylistDetailPayload } from '@/event/appEvent'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useMyList } from '@/store/list/hook'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { applyMusicCoverFallback } from '@/utils/musicCover'
import { createStyle } from '@/utils/tools'
import { getSourceTone } from '@/components/search/sourceTone'
import PlaylistDetailHeader from './PlaylistDetailHeader'
import PlaylistDetailSongItem, { SONG_ITEM_HEIGHT } from './PlaylistDetailSongItem'
import PlaylistImportPanel from './PlaylistImportPanel'
import PlaylistSongDragOverlay from './PlaylistSongDragOverlay'
import { usePlaylistDetailData, getOnlinePlaylistDetailKey, getLbCacheKey } from './hooks/usePlaylistDetailData'
import { useSongDragReorder } from './hooks/useSongDragReorder'
import { usePlaylistImport } from './hooks/usePlaylistImport'

const BOTTOM_DOCK_BASE_HEIGHT = 164
const DETAIL_TRANSITION_FORWARD_DURATION = 268
const DETAIL_TRANSITION_BACKWARD_DURATION = 220

const isUserListInfo = (listInfo: LX.List.MyListInfo | null): listInfo is LX.List.UserListInfo => {
  return Boolean(listInfo && 'locationUpdateTime' in listInfo)
}

export interface PlaylistDetailOverlayProps {
  detail: PlaylistDetailPayload
  onClose: () => void
}

const PlaylistDetailOverlay = ({ detail, onClose }: PlaylistDetailOverlayProps) => {
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const playlists = useMyList()
  const modalBottomInset = useMemo(() => {
    const screenHeight = Dimensions.get('screen').height
    const windowHeight = Dimensions.get('window').height
    const extraInset = Math.max(0, screenHeight - windowHeight)
    if (!extraInset) return 0
    if (Platform.OS == 'android') return Math.max(0, extraInset - statusBarHeight)
    return extraInset
  }, [statusBarHeight])
  const detailSceneWidth = Dimensions.get('window').width
  const detailSceneAnim = useRef(new Animated.Value(0)).current
  const detailTransitionTokenRef = useRef(0)

  const detailData = usePlaylistDetailData(detail, playlists)
  const drag = useSongDragReorder({
    detailSongsRef: detailData.detailSongsRef,
    setDetailSongs: detailData.setDetailSongs,
    selectedListId: detailData.selectedListId,
    loadLocalDetailSongs: detailData.loadLocalDetailSongs,
  })
  const imprt = usePlaylistImport({
    selectedListId: detailData.selectedListId,
    playlists,
    loadLocalDetailSongs: detailData.loadLocalDetailSongs,
  })

  const selectedListIdRef = useRef(detailData.selectedListId)
  selectedListIdRef.current = detailData.selectedListId
  const selectedOnlineDetailRef = useRef(detailData.selectedOnlineDetail)
  selectedOnlineDetailRef.current = detailData.selectedOnlineDetail
  const selectedLeaderboardDetailRef = useRef(detailData.selectedLeaderboardDetail)
  selectedLeaderboardDetailRef.current = detailData.selectedLeaderboardDetail
  const detailHeroCoverRef = useRef(detailData.detailHeroCover)
  detailHeroCoverRef.current = detailData.detailHeroCover
  const pendingDeleteSongRef = useRef<LX.Music.MusicInfo | null>(null)

  const musicMultiAddModalRef = useRef<MusicMultiAddModalType>(null)
  const renameListDialogRef = useRef<PromptDialogType>(null)
  const removeListDialogRef = useRef<PromptDialogType>(null)
  const removeSongDialogRef = useRef<PromptDialogType>(null)

  const [isDetailTransitioning, setDetailTransitioning] = useState(false)
  const [pendingDeleteSong, setPendingDeleteSong] = useState<LX.Music.MusicInfo | null>(null)

  useEffect(() => {
    pendingDeleteSongRef.current = pendingDeleteSong
  }, [pendingDeleteSong])

  const detailSceneTranslateX = useMemo(() => detailSceneAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [detailSceneWidth, 0],
  }), [detailSceneAnim, detailSceneWidth])

  const setKeepPlayBarVisible = (visible: boolean) => {
    Reflect.set(global.lx, 'keepPlayBarOnKeyboard', visible)
  }

  const animateDetailScene = useCallback((toValue: 0 | 1, onFinish?: () => void) => {
    const token = ++detailTransitionTokenRef.current
    setDetailTransitioning(true)
    detailSceneAnim.stopAnimation()
    Animated.timing(detailSceneAnim, {
      toValue,
      duration: toValue ? DETAIL_TRANSITION_FORWARD_DURATION : DETAIL_TRANSITION_BACKWARD_DURATION,
      easing: toValue
        ? Easing.bezier(0.36, 0.66, 0.04, 1)
        : Easing.bezier(0.32, 0.72, 0, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (token !== detailTransitionTokenRef.current) return
      if (finished) onFinish?.()
      setDetailTransitioning(false)
    })
  }, [detailSceneAnim])

  const handleCloseDetail = useCallback(() => {
    detailData.detailRequestIdRef.current += 1
    drag.resetSongDragState()
    imprt.setImportDrawerVisible(false)
    animateDetailScene(0, onClose)
  }, [animateDetailScene, onClose, drag.resetSongDragState, imprt.setImportDrawerVisible, detailData.detailRequestIdRef])

  const handlePlaySong = useCallback(async(listId: string, song: LX.Music.MusicInfo, fallbackIndex: number) => {
    setActiveList(listId)
    const latestList = await getListMusics(listId)
    let targetIndex = latestList.findIndex(item => item.id === song.id && item.source === song.source)
    if (targetIndex < 0) targetIndex = latestList.findIndex(item => item.id === song.id)
    if (targetIndex < 0) targetIndex = fallbackIndex
    if (targetIndex < 0) return
    await playListAsQueue(listId, targetIndex)
  }, [])

  const handlePlayOnlineDetailSong = useCallback(async(song: LX.Music.MusicInfo, fallbackIndex: number) => {
    if (!selectedOnlineDetailRef.current) return
    let latestList = applyMusicCoverFallback(detailData.detailSongsRef.current, detailHeroCoverRef.current)
    if (!latestList.length) {
      latestList = applyMusicCoverFallback(
        await getListDetailAll(selectedOnlineDetailRef.current.source, selectedOnlineDetailRef.current.id),
        selectedOnlineDetailRef.current.img ?? null,
      )
    }
    if (!latestList.length) return
    let targetIndex = latestList.findIndex(item => item.id === song.id && item.source === song.source)
    if (targetIndex < 0) targetIndex = latestList.findIndex(item => item.id === song.id)
    if (targetIndex < 0) targetIndex = fallbackIndex
    if (targetIndex < 0) return
    await setTempList(getOnlinePlaylistDetailKey(selectedOnlineDetailRef.current), latestList)
    await playList(LIST_IDS.TEMP, targetIndex)
  }, [detailData.detailSongsRef])

  const handlePlayLeaderboardSong = useCallback(async(song: LX.Music.MusicInfo, fallbackIndex: number) => {
    if (!selectedLeaderboardDetailRef.current) return
    let latestList = applyMusicCoverFallback(detailData.detailSongsRef.current, null)
    if (!latestList.length) {
      latestList = applyMusicCoverFallback(await getLeaderboardListDetailAll(selectedLeaderboardDetailRef.current.boardId), null)
    }
    if (!latestList.length) return
    let targetIndex = latestList.findIndex(item => item.id === song.id && item.source === song.source)
    if (targetIndex < 0) targetIndex = latestList.findIndex(item => item.id === song.id)
    if (targetIndex < 0) targetIndex = fallbackIndex
    if (targetIndex < 0) return
    await setTempList(getLbCacheKey(selectedLeaderboardDetailRef.current), latestList)
    await playList(LIST_IDS.TEMP, targetIndex)
  }, [detailData.detailSongsRef])

  const handleShowRemoveSongModal = useCallback((song: LX.Music.MusicInfo) => {
    if (!selectedListIdRef.current || drag.dragStateRef.current.active) return
    setPendingDeleteSong(song)
    removeSongDialogRef.current?.show('')
  }, [drag.dragStateRef])

  const handleCancelRemoveSong = useCallback(() => {
    setPendingDeleteSong(null)
  }, [])

  const handleConfirmRemoveSong = useCallback(async() => {
    if (!selectedListIdRef.current || !pendingDeleteSongRef.current || drag.dragStateRef.current.active) {
      setPendingDeleteSong(null)
      return true
    }
    await removeListMusics(selectedListIdRef.current, [String(pendingDeleteSongRef.current.id)])
    setPendingDeleteSong(null)
    await detailData.loadLocalDetailSongs(selectedListIdRef.current)
    return true
  }, [detailData.loadLocalDetailSongs, drag.dragStateRef])

  const handleShowRenameListModal = useCallback(() => {
    if (!isUserListInfo(detailData.selectedListInfo)) return
    renameListDialogRef.current?.show(detailData.selectedListInfo.name)
  }, [detailData.selectedListInfo])

  const handleShowRemoveListModal = useCallback(() => {
    if (!isUserListInfo(detailData.selectedListInfo)) return
    removeListDialogRef.current?.show('')
  }, [detailData.selectedListInfo])

  const handleRenameList = useCallback(async(name: string) => {
    if (!isUserListInfo(detailData.selectedListInfo)) return false
    const targetName = name.trim().substring(0, 100)
    if (!targetName.length) return false
    if (targetName == detailData.selectedListInfo.name) return true
    await updateUserList([{
      id: detailData.selectedListInfo.id,
      name: targetName,
      source: detailData.selectedListInfo.source,
      sourceListId: detailData.selectedListInfo.sourceListId,
      locationUpdateTime: detailData.selectedListInfo.locationUpdateTime,
    }])
    return true
  }, [detailData.selectedListInfo])

  const handleRemoveSelectedList = useCallback(async() => {
    if (!isUserListInfo(detailData.selectedListInfo)) return false
    await removeUserList([detailData.selectedListInfo.id])
    handleCloseDetail()
    return true
  }, [handleCloseDetail, detailData.selectedListInfo])

  const handleShowPlaylistTransferModal = useCallback(() => {
    if (!detailData.selectedOnlineDetail || detailData.detailLoading || !detailData.detailSongs.length) return
    const transferSongs = applyMusicCoverFallback(detailData.detailSongs, detailData.detailHeroCover)
    musicMultiAddModalRef.current?.show({
      selectedList: [...transferSongs],
      listId: '',
      isMove: false,
      defaultNewListName: detailData.detailHeroName,
    })
  }, [detailData.selectedOnlineDetail, detailData.detailLoading, detailData.detailSongs, detailData.detailHeroCover, detailData.detailHeroName])

  const renderSongItem: ListRenderItem<LX.Music.MusicInfo> = useCallback(({ item, index }) => {
    const songKey = drag.getSongRowKey(item, index)
    const isDraggingRow = drag.dragStateRef.current.songKey == songKey && drag.dragStateRef.current.active
    const shiftAnim = drag.getSongShiftAnim(songKey)
    const sourceTagColor = getSourceTone(item.source)
    const canEditSongs = Boolean(selectedListIdRef.current)
    return (
      <PlaylistDetailSongItem
        song={item}
        sourceTone={sourceTagColor}
        shiftAnim={shiftAnim}
        fallbackCover={detailHeroCoverRef.current}
        isGhost={isDraggingRow}
        canEdit={canEditSongs}
        onLayout={(event) => { drag.handleSongRowLayout(item, index, event) }}
        onDragPressIn={canEditSongs ? (event) => { drag.handleStartSongDrag(item, index, event) } : undefined}
        onPress={() => {
          if (drag.skipNextSongPressRef.current) {
            if (drag.dragStateRef.current.active) {
              void drag.handleFinishSongDrag()
            } else {
              drag.clearDragPressGuard()
            }
            return
          }
          if (selectedListIdRef.current) {
            void handlePlaySong(selectedListIdRef.current, item, index)
            return
          }
          if (selectedLeaderboardDetailRef.current) {
            void handlePlayLeaderboardSong(item, index)
            return
          }
          void handlePlayOnlineDetailSong(item, index)
        }}
        onRemove={canEditSongs ? () => { handleShowRemoveSongModal(item) } : undefined}
      />
    )
  }, [
    drag.getSongRowKey, drag.getSongShiftAnim, drag.handleSongRowLayout,
    drag.handleStartSongDrag, drag.handleFinishSongDrag, drag.clearDragPressGuard,
    drag.dragStateRef, drag.skipNextSongPressRef,
    handlePlaySong, handlePlayOnlineDetailSong, handlePlayLeaderboardSong,
    handleShowRemoveSongModal,
  ])

  const detailHeader = useMemo(() => {
    const detailActionLabel = detailData.selectedOnlineOrLeaderboard
      ? t('playlist_transfer_all')
      : detailData.selectedListId
        ? t('list_import')
        : null
    const detailActionDisabled = detailData.selectedOnlineOrLeaderboard
      ? detailData.detailLoading || !detailData.detailSongs.length
      : false
    return (
      <PlaylistDetailHeader
        statusBarHeight={statusBarHeight}
        cover={detailData.detailHeroCover}
        name={detailData.detailHeroName}
        metaText={detailData.detailHeroMetaText}
        sectionTitle={t('me_songs')}
        sourceCode={detailData.selectedOnlineOrLeaderboard?.source}
        sourceLabel={detailData.detailHeroSourceLabel}
        sourceTone={detailData.detailHeroSourceTone}
        canRename={detailData.canRenameSelectedList}
        actionLabel={detailActionLabel}
        actionDisabled={detailActionDisabled}
        onBack={handleCloseDetail}
        onRename={handleShowRenameListModal}
        onRemove={handleShowRemoveListModal}
        onActionPress={detailData.selectedOnlineOrLeaderboard ? handleShowPlaylistTransferModal : imprt.handleOpenImportDrawer}
      />
    )
  }, [
    detailData.detailHeroCover, detailData.detailHeroMetaText, detailData.detailHeroName,
    detailData.detailHeroSourceLabel, detailData.detailHeroSourceTone,
    detailData.canRenameSelectedList, detailData.selectedOnlineOrLeaderboard,
    detailData.selectedListId, detailData.detailLoading, detailData.detailSongs.length,
    handleCloseDetail, handleShowPlaylistTransferModal, handleShowRemoveListModal,
    handleShowRenameListModal, imprt.handleOpenImportDrawer,
    statusBarHeight, t,
  ])

  useEffect(() => {
    if (detailData.detailHeroCover && (detailData.detailHeroCover.startsWith('http://') || detailData.detailHeroCover.startsWith('https://'))) {
      RNImage.prefetch(detailData.detailHeroCover).catch(() => {})
    }
  }, [detailData.detailHeroCover])

  useEffect(() => {
    setKeepPlayBarVisible(false)
    detailSceneAnim.setValue(0)
    const interactionHandle = InteractionManager.createInteractionHandle()
    animateDetailScene(1, () => {
      InteractionManager.clearInteractionHandle(interactionHandle)
    })
    return () => {
      InteractionManager.clearInteractionHandle(interactionHandle)
      setKeepPlayBarVisible(false)
    }
  }, [animateDetailScene, detailSceneAnim, detailData.selectedDetailCacheKey])

  useEffect(() => {
    if (!detailData.selectedListId) return
    if (playlists.some(list => list.id === detailData.selectedListId)) return
    handleCloseDetail()
  }, [handleCloseDetail, playlists, detailData.selectedListId])

  useEffect(() => {
    const handleClosePlaylistDetail = () => {
      handleCloseDetail()
    }
    global.app_event.on('closePlaylistDetail', handleClosePlaylistDetail)
    return () => {
      global.app_event.off('closePlaylistDetail', handleClosePlaylistDetail)
    }
  }, [handleCloseDetail])

  useEffect(() => {
    drag.measureDetailListWrap()
  }, [drag.measureDetailListWrap, detailData.selectedDetailCacheKey])

  useBackHandler(useCallback(() => {
    if (imprt.isImportDrawerVisible) {
      imprt.handleCloseImportDrawer()
      return true
    }
    handleCloseDetail()
    return true
  }, [handleCloseDetail, imprt.handleCloseImportDrawer, imprt.isImportDrawerVisible]))

  const draggingSourceTagColor = drag.draggingSong ? getSourceTone(drag.draggingSong.source) : null

  return (
    <View style={styles.root} pointerEvents="box-none">
      <Animated.View
        renderToHardwareTextureAndroid={isDetailTransitioning}
        shouldRasterizeIOS={isDetailTransitioning}
        style={[
          styles.scene,
          {
            transform: [{ translateX: detailSceneTranslateX }],
          },
        ]}
      >
        <View
          ref={drag.detailListWrapRef}
          style={styles.detailListWrap}
          onLayout={drag.handleDetailWrapLayout}
          collapsable={false}
          {...drag.detailListPanResponder.panHandlers}
        >
          <FlatList
            ref={drag.detailListRef}
            style={styles.container}
            contentContainerStyle={[styles.detailContent, { paddingBottom: BOTTOM_DOCK_BASE_HEIGHT }]}
            data={detailData.detailSongs}
            renderItem={renderSongItem}
            keyExtractor={(item, index) => drag.getSongRowKey(item, index)}
            getItemLayout={(_data, index) => ({
              length: SONG_ITEM_HEIGHT,
              offset: SONG_ITEM_HEIGHT * index,
              index,
            })}
            ListHeaderComponent={detailHeader}
            ListEmptyComponent={(
              <View style={styles.emptyCard}>
                <Text size={13} color="#6b7280">{detailData.detailLoading ? t('me_loading_songs') : t('me_no_songs')}</Text>
              </View>
            )}
            showsVerticalScrollIndicator={false}
            initialNumToRender={12}
            windowSize={drag.isSongDragActive ? 4 : 6}
            maxToRenderPerBatch={drag.isSongDragActive ? 6 : 8}
            updateCellsBatchingPeriod={drag.isSongDragActive ? 24 : 16}
            removeClippedSubviews={false}
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
            onScroll={drag.handleDetailListScroll}
            onContentSizeChange={drag.handleDetailListContentSizeChange}
            scrollEventThrottle={16}
            scrollEnabled={!drag.isSongDragActive}
          />
          {drag.draggingSong && draggingSourceTagColor
            ? <PlaylistSongDragOverlay
                song={drag.draggingSong}
                sourceTone={draggingSourceTagColor}
                top={drag.dragTop}
                scale={drag.dragScale}
                opacity={drag.dragOpacity}
                fallbackCover={detailData.detailHeroCover}
              />
            : null}
        </View>
        {detailData.selectedListId
          ? <PlaylistImportPanel
              visible={imprt.isImportDrawerVisible}
              loading={imprt.importLoading}
              submitting={imprt.importSubmitting}
              bottomInset={modalBottomInset}
              targetListName={detailData.selectedListInfo?.name}
              items={imprt.importCandidates}
              selectedMap={imprt.importSelectedMap}
              allSelected={imprt.areAllImportSongsSelected}
              cancelText={t('cancel')}
              title={t('list_import')}
              selectAllText={t('list_select_all')}
              clearSelectionText={t('list_select_cancel')}
              loadingText={t('list_loading')}
              emptyText={t('me_no_songs')}
              countText={t('me_songs_count', { num: imprt.importCandidates.length })}
              confirmText={`${t('list_add_title_first_add')}${imprt.importSelectedCount > 0 ? `(${imprt.importSelectedCount})` : ''}`}
              onClose={imprt.handleCloseImportDrawer}
              onSubmit={() => { void imprt.handleImportSelectedSongs() }}
              onToggleSelectAll={imprt.handleToggleSelectAllImportSongs}
              onToggleItem={imprt.handleToggleImportSong}
              getSourceTone={getSourceTone}
            />
          : null}
        {detailData.selectedListId
          ? <>
              <PromptDialog
                ref={renameListDialogRef}
                title={t('list_rename_title')}
                placeholder={t('list_create_input_placeholder')}
                confirmText={t('metadata_edit_modal_confirm')}
                cancelText={t('cancel')}
                bgHide={false}
                onConfirm={async(value) => handleRenameList(value)}
              />
              <PromptDialog
                ref={removeListDialogRef}
                title={t('list_remove_tip', { name: detailData.selectedListInfo?.name ?? '' })}
                confirmText={t('list_remove_tip_button')}
                cancelText={t('cancel')}
                showInput={false}
                bgHide={false}
                onConfirm={async() => handleRemoveSelectedList()}
              />
              <PromptDialog
                ref={removeSongDialogRef}
                title={t('list_remove_tip', { name: pendingDeleteSong?.name ?? '' })}
                confirmText={t('list_remove_tip_button')}
                cancelText={t('cancel')}
                showInput={false}
                bgHide={false}
                onCancel={handleCancelRemoveSong}
                onHide={handleCancelRemoveSong}
                onConfirm={async() => handleConfirmRemoveSong()}
              />
            </>
          : null}
      </Animated.View>
      {detailData.selectedOnlineOrLeaderboard ? <MusicMultiAddModal ref={musicMultiAddModalRef} /> : null}
    </View>
  )
}

export default memo(PlaylistDetailOverlay, (prev, next) => {
  return prev.detail === next.detail && prev.onClose === next.onClose
})

const styles = createStyle({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  scene: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    elevation: 0,
    backgroundColor: '#eef0fb',
  },
  container: {
    flex: 1,
    backgroundColor: '#eef0fb',
  },
  detailContent: {
    paddingBottom: 0,
    paddingHorizontal: 18,
  },
  detailListWrap: {
    flex: 1,
    position: 'relative',
  },
  emptyCard: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(244,247,252,0.72)',
    backgroundColor: 'rgba(255,255,255,0.88)',
    shadowColor: '#76809b',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
