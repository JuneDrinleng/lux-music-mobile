/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Dimensions,
  FlatList,
  Image as RNImage,
  Platform,
  View,
  type ListRenderItem,
} from 'react-native'

import MusicMultiAddModal, { type MusicMultiAddModalType } from '@/components/MusicMultiAddModal'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import { EmptyState, PrimaryButton, SecondaryButton } from '@/components/magazine'
import { LIST_IDS } from '@/config/constant'
import { getListMusics, removeListMusics, removeUserList, setActiveList, setTempList, updateUserList } from '@/core/list'
import { playList, playListAsQueue } from '@/core/player/player'
import { getListDetailAll } from '@/core/songlist'
import { getListDetailAll as getLeaderboardListDetailAll } from '@/core/leaderboard'
import { type PlaylistDetailPayload } from '@/event/appEvent'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useMyList } from '@/store/list/hook'
import { useIsPlay, usePlayMusicInfo } from '@/store/player/hook'
import { applyMusicCoverFallback } from '@/utils/musicCover'
import { demoteOpenPlaylistCoverWork, prioritizePlaylistCovers, setPlaylistCoverFocus } from '@/utils/playlistCoverPrefetch'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { arrShuffle, confirmDialog, createStyle, toast } from '@/utils/tools'
import { getSourceTone } from '@/components/search/sourceTone'
import PlaylistDetailHeader, { PlaylistSelectHeader } from './PlaylistDetailHeader'
import PlaylistDetailSongItem, { SONG_ITEM_HEIGHT } from './PlaylistDetailSongItem'
import PlaylistImportPanel from './PlaylistImportPanel'
import PlaylistSongDragOverlay from './PlaylistSongDragOverlay'
import { usePlaylistDetailData, getOnlinePlaylistDetailKey, getLbCacheKey } from './hooks/usePlaylistDetailData'
import { useSongDragReorder } from './hooks/useSongDragReorder'
import { usePlaylistImport } from './hooks/usePlaylistImport'
import { useDetailSceneTransition } from './detailSceneTransition'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER } from '@/theme/magazineType'

const isUserListInfo = (listInfo: LX.List.MyListInfo | null): listInfo is LX.List.UserListInfo => {
  return Boolean(listInfo && 'locationUpdateTime' in listInfo)
}

const songKeyOf = (song: LX.Music.MusicInfo, index: number) => `${song.source}_${song.id}_${index}`

export interface PlaylistDetailViewProps {
  detail: PlaylistDetailPayload | null
  onClose?: () => void
  bottomPadding?: number
}

const PlaylistDetailViewInner = ({
  detail,
  onClose,
  bottomPadding = 0,
}: PlaylistDetailViewProps & { detail: PlaylistDetailPayload }) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)

  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const playlists = useMyList()
  const playMusicInfo = usePlayMusicInfo()
  const isPlay = useIsPlay()
  const modalBottomInset = useMemo(() => {
    const screenHeight = Dimensions.get('screen').height
    const windowHeight = Dimensions.get('window').height
    const extraInset = Math.max(0, screenHeight - windowHeight)
    if (!extraInset) return 0
    if (Platform.OS == 'android') return Math.max(0, extraInset - statusBarHeight)
    return extraInset
  }, [statusBarHeight])

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
  const onCoverViewableItemsChanged = useRef((info: { viewableItems: Array<{ item?: LX.Music.MusicInfo | null }> }) => {
    const visible: LX.Music.MusicInfo[] = []
    for (const token of info.viewableItems) {
      if (token.item?.id && token.item.source != 'local') visible.push(token.item)
    }
    if (visible.length) prioritizePlaylistCovers(visible, 'visible')
  }).current
  const coverViewabilityConfig = useRef({ itemVisiblePercentThreshold: 25, minimumViewTime: 60 }).current
  const pendingDeleteSongRef = useRef<LX.Music.MusicInfo | null>(null)

  const musicMultiAddModalRef = useRef<MusicMultiAddModalType>(null)
  const renameListDialogRef = useRef<PromptDialogType>(null)
  const removeListDialogRef = useRef<PromptDialogType>(null)
  const removeSongDialogRef = useRef<PromptDialogType>(null)

  const [pendingDeleteSong, setPendingDeleteSong] = useState<LX.Music.MusicInfo | null>(null)
  const [selecting, setSelecting] = useState(false)
  const [selectedMap, setSelectedMap] = useState<Record<string, true>>({})
  const [selectMode, setSelectMode] = useState<'single' | 'range' | 'inverse'>('single')
  const [rangeAnchor, setRangeAnchor] = useState<number | null>(null)
  const { style: sceneStyle, requestClose } = useDetailSceneTransition(detailData.selectedDetailCacheKey)

  useEffect(() => {
    pendingDeleteSongRef.current = pendingDeleteSong
  }, [pendingDeleteSong])

  useEffect(() => {
    setPlaylistCoverFocus(detailData.selectedListId)
    return () => {
      setPlaylistCoverFocus(null)
      demoteOpenPlaylistCoverWork()
    }
  }, [detailData.selectedListId])

  useEffect(() => {
    if (!detailData.detailSongs.length) return
    prioritizePlaylistCovers(detailData.detailSongs, 'playlist')
  }, [detailData.detailSongs])

  useEffect(() => {
    setSelecting(false)
    setSelectedMap({})
    setSelectMode('single')
    setRangeAnchor(null)
  }, [detailData.selectedDetailCacheKey])

  const handleCloseDetail = useCallback(() => {
    detailData.detailRequestIdRef.current += 1
    drag.resetSongDragState()
    imprt.setImportDrawerVisible(false)
    setSelecting(false)
    setSelectedMap({})
    requestClose(() => { onClose?.() })
  }, [onClose, drag.resetSongDragState, imprt.setImportDrawerVisible, detailData.detailRequestIdRef, requestClose])

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

  const playAllSongs = useCallback(async(shuffle: boolean) => {
    const songs = detailData.detailSongsRef.current
    if (!songs.length) {
      toast(t('me_no_songs'))
      return
    }
    if (selectedListIdRef.current) {
      if (shuffle) {
        const shuffled: LX.Music.MusicInfo[] = arrShuffle(songs.slice())
        await setTempList(`shuffle_${selectedListIdRef.current}`, shuffled)
        await playList(LIST_IDS.TEMP, 0)
        return
      }
      await playListAsQueue(selectedListIdRef.current, 0)
      return
    }
    if (selectedOnlineDetailRef.current) {
      const list: LX.Music.MusicInfo[] = applyMusicCoverFallback(songs, detailHeroCoverRef.current)
      const queue: LX.Music.MusicInfo[] = shuffle ? arrShuffle(list.slice()) : list
      await setTempList(getOnlinePlaylistDetailKey(selectedOnlineDetailRef.current), queue)
      await playList(LIST_IDS.TEMP, 0)
      return
    }
    if (selectedLeaderboardDetailRef.current) {
      const list: LX.Music.MusicInfo[] = applyMusicCoverFallback(songs, null)
      const queue: LX.Music.MusicInfo[] = shuffle ? arrShuffle(list.slice()) : list
      await setTempList(getLbCacheKey(selectedLeaderboardDetailRef.current), queue)
      await playList(LIST_IDS.TEMP, 0)
    }
  }, [detailData.detailSongsRef, t])

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

  const canSelect = Boolean(detailData.selectedListId)
  const selectedSongs = useMemo(
    () => detailData.detailSongs.filter((song, index) => selectedMap[songKeyOf(song, index)]),
    [detailData.detailSongs, selectedMap],
  )
  const selectedCount = selectedSongs.length

  const handleToggleSelectMode = useCallback(() => {
    setSelecting(true)
    setSelectedMap({})
    setSelectMode('single')
    setRangeAnchor(null)
  }, [])

  const handleCancelSelect = useCallback(() => {
    setSelecting(false)
    setSelectedMap({})
    setSelectMode('single')
    setRangeAnchor(null)
  }, [])

  const handleSelectAll = useCallback(() => {
    const next: Record<string, true> = {}
    detailData.detailSongs.forEach((song, index) => {
      next[songKeyOf(song, index)] = true
    })
    setSelectedMap(next)
  }, [detailData.detailSongs])

  const handleSelectModeChange = useCallback((id: string) => {
    if (id === 'inverse') {
      setSelectedMap(current => {
        const next: Record<string, true> = {}
        detailData.detailSongs.forEach((song, index) => {
          const key = songKeyOf(song, index)
          if (!current[key]) next[key] = true
        })
        return next
      })
      setSelectMode('single')
      setRangeAnchor(null)
      return
    }
    setSelectMode(id as 'single' | 'range')
    setRangeAnchor(null)
  }, [detailData.detailSongs])

  const handleToggleSongSelect = useCallback((song: LX.Music.MusicInfo, index: number) => {
    const key = songKeyOf(song, index)
    if (selectMode === 'range') {
      if (rangeAnchor == null) {
        setRangeAnchor(index)
        setSelectedMap({ [key]: true })
        return
      }
      const from = Math.min(rangeAnchor, index)
      const to = Math.max(rangeAnchor, index)
      const next: Record<string, true> = {}
      for (let i = from; i <= to; i += 1) {
        const item = detailData.detailSongs[i]
        if (item) next[songKeyOf(item, i)] = true
      }
      setSelectedMap(next)
      setRangeAnchor(null)
      return
    }
    setSelectedMap(current => {
      const next = { ...current }
      if (next[key]) delete next[key]
      else next[key] = true
      return next
    })
  }, [detailData.detailSongs, rangeAnchor, selectMode])

  const handleMultiAdd = useCallback((isMove: boolean) => {
    if (!selectedListIdRef.current || !selectedSongs.length) return
    musicMultiAddModalRef.current?.show({
      selectedList: [...selectedSongs],
      listId: selectedListIdRef.current,
      isMove,
    })
  }, [selectedSongs])

  const handleMultiRemove = useCallback(async() => {
    if (!selectedListIdRef.current || !selectedSongs.length) return
    const confirmed = await confirmDialog({
      message: t('list_remove_music_multi_tip', { num: selectedSongs.length }),
      confirmButtonText: t('list_remove_tip_button'),
    })
    if (!confirmed) return
    await removeListMusics(selectedListIdRef.current, selectedSongs.map(song => String(song.id)))
    setSelectedMap({})
    setSelecting(false)
    await detailData.loadLocalDetailSongs(selectedListIdRef.current)
  }, [detailData.loadLocalDetailSongs, selectedSongs, t])

  const isSongPlaying = useCallback((song: LX.Music.MusicInfo) => {
    const current = playMusicInfo.musicInfo
    if (!current || !isPlay) return false
    return current.id === song.id && current.source === song.source
  }, [isPlay, playMusicInfo.musicInfo])

  const renderSongItem: ListRenderItem<LX.Music.MusicInfo> = useCallback(({ item, index }) => {
    const songKey = drag.getSongRowKey(item, index)
    const isDraggingRow = drag.dragStateRef.current.songKey == songKey && drag.dragStateRef.current.active
    const shiftAnim = drag.getSongShiftAnim(songKey)
    const canEditSongs = Boolean(selectedListIdRef.current) && !selecting
    const selectKey = songKeyOf(item, index)
    return (
      <PlaylistDetailSongItem
        song={item}
        index={index}
        shiftAnim={shiftAnim}
        fallbackCover={detailHeroCoverRef.current}
        isGhost={isDraggingRow}
        canEdit={canEditSongs}
        selecting={selecting}
        selected={Boolean(selectedMap[selectKey])}
        playing={isSongPlaying(item)}
        last={index >= detailData.detailSongs.length - 1}
        onLayout={(event) => { drag.handleSongRowLayout(item, index, event) }}
        onDragPressIn={canEditSongs ? (event) => { drag.handleStartSongDrag(item, index, event) } : undefined}
        onPress={() => {
          if (selecting) {
            handleToggleSongSelect(item, index)
            return
          }
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
    handleShowRemoveSongModal, handleToggleSongSelect,
    selecting, selectedMap, isSongPlaying, detailData.detailSongs.length,
  ])

  const playlistEyebrow = useMemo(() => {
    if (detailData.selectedLeaderboardDetail) {
      return t('library_playlist_eyebrow_chart', {
        source: detailData.detailHeroSourceLabel || detailData.selectedLeaderboardDetail.source,
      })
    }
    if (detailData.selectedOnlineDetail) return t('library_playlist_eyebrow_online')
    if (detailData.selectedListId === LIST_IDS.LOVE) return t('library_playlist_eyebrow_love')
    if (detailData.selectedListId === LIST_IDS.DEFAULT) return t('library_playlist_eyebrow_default')
    return t('library_playlist_eyebrow_user')
  }, [detailData.selectedLeaderboardDetail, detailData.selectedOnlineDetail, detailData.selectedListId, detailData.detailHeroSourceLabel, t])

  const selectTabs = useMemo(() => [
    { id: 'single', label: t('list_select_single') },
    { id: 'range', label: t('list_select_range') },
    { id: 'inverse', label: t('list_select_unall') },
  ], [t])

  const detailHeader = useMemo(() => {
    if (selecting) {
      return (
        <PlaylistSelectHeader
          statusBarHeight={statusBarHeight}
          cancelLabel={t('list_select_cancel')}
          selectAllLabel={t('list_select_all')}
          eyebrow={`${detailData.detailHeroName} · ${t('me_tracks_count', { num: detailData.detailSongs.length })}`}
          title={t('library_selected_count', { num: selectedCount })}
          tabs={selectTabs}
          mode={selectMode}
          onCancel={handleCancelSelect}
          onSelectAll={handleSelectAll}
          onModeChange={handleSelectModeChange}
        />
      )
    }
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
        eyebrow={playlistEyebrow}
        sectionTitle={t('me_songs')}
        sectionMeta={t('me_tracks_count', { num: detailData.detailSongs.length })}
        canRename={detailData.canRenameSelectedList}
        canSelect={canSelect}
        primaryLabel={t('play_all')}
        secondaryLabel={detailData.selectedOnlineOrLeaderboard ? t('playlist_transfer_all') : t('play_shuffle_short')}
        actionLabel={detailData.selectedOnlineOrLeaderboard ? null : detailActionLabel}
        actionDisabled={detailActionDisabled}
        onBack={handleCloseDetail}
        onRename={handleShowRenameListModal}
        onRemove={handleShowRemoveListModal}
        onPrimaryPress={() => { void playAllSongs(false) }}
        onSecondaryPress={() => {
          if (detailData.selectedOnlineOrLeaderboard) {
            handleShowPlaylistTransferModal()
            return
          }
          void playAllSongs(true)
        }}
        onActionPress={imprt.handleOpenImportDrawer}
        onToggleSelect={handleToggleSelectMode}
      />
    )
  }, [
    selecting, selectedCount, selectTabs, selectMode,
    detailData.detailHeroCover, detailData.detailHeroMetaText, detailData.detailHeroName,
    detailData.canRenameSelectedList, detailData.selectedOnlineOrLeaderboard,
    detailData.selectedListId, detailData.detailLoading, detailData.detailSongs.length,
    playlistEyebrow, canSelect,
    handleCloseDetail, handleShowPlaylistTransferModal, handleShowRemoveListModal,
    handleShowRenameListModal, imprt.handleOpenImportDrawer, handleToggleSelectMode,
    handleCancelSelect, handleSelectAll, handleSelectModeChange, playAllSongs,
    statusBarHeight, t,
  ])

  useEffect(() => {
    if (detailData.detailHeroCover && (detailData.detailHeroCover.startsWith('http://') || detailData.detailHeroCover.startsWith('https://'))) {
      RNImage.prefetch(detailData.detailHeroCover).catch(() => {})
    }
  }, [detailData.detailHeroCover])

  useEffect(() => {
    if (!detailData.selectedListId) return
    if (playlists.some(list => list.id === detailData.selectedListId)) return
    handleCloseDetail()
  }, [handleCloseDetail, playlists, detailData.selectedListId])

  useEffect(() => {
    drag.measureDetailListWrap()
  }, [drag.measureDetailListWrap, detailData.selectedDetailCacheKey])

  useBackHandler(useCallback(() => {
    if (selecting) {
      handleCancelSelect()
      return true
    }
    if (imprt.isImportDrawerVisible) {
      imprt.handleCloseImportDrawer()
      return true
    }
    handleCloseDetail()
    return true
  }, [handleCloseDetail, handleCancelSelect, selecting, imprt.handleCloseImportDrawer, imprt.isImportDrawerVisible]))

  const draggingSourceTagColor = drag.draggingSong ? getSourceTone(drag.draggingSong.source, colors) : null

  return (
    <Animated.View style={[styles.root, sceneStyle, { backgroundColor: r.paper }]}>
      <View
        ref={drag.detailListWrapRef}
        style={styles.detailListWrap}
        onLayout={drag.handleDetailWrapLayout}
        collapsable={false}
        {...drag.detailListPanResponder.panHandlers}
      >
        <FlatList
          ref={drag.detailListRef}
          style={[styles.container, { backgroundColor: r.paper }]}
          contentContainerStyle={[styles.detailContent, { paddingBottom: bottomPadding + (selecting ? 72 : 0) }]}
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
            <EmptyState
              eyebrow={detailData.detailLoading ? 'LOADING' : 'EMPTY · 0'}
              title={detailData.detailLoading ? t('me_loading_songs') : t('me_no_songs')}
            />
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
          onViewableItemsChanged={onCoverViewableItemsChanged}
          viewabilityConfig={coverViewabilityConfig}
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
      {selecting
        ? (
          <View style={[styles.selectBar, { bottom: bottomPadding + 8, borderTopColor: r.ink }]}>
            <SecondaryButton
              label={t('add_to')}
              icon="playlist-plus"
              disabled={!selectedCount}
              onPress={() => { handleMultiAdd(false) }}
              style={{ flex: 1 }}
            />
            <SecondaryButton
              label={t('move_to')}
              icon="folder-move-outline"
              disabled={!selectedCount}
              onPress={() => { handleMultiAdd(true) }}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label={t('list_remove')}
              icon="trash-can-outline"
              danger
              disabled={!selectedCount}
              onPress={() => { void handleMultiRemove() }}
              style={{ flex: 1 }}
            />
          </View>
          )
        : null}
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
      <MusicMultiAddModal ref={musicMultiAddModalRef} />
    </Animated.View>
  )
}

const PlaylistDetailView = ({ detail, onClose, bottomPadding }: PlaylistDetailViewProps) => {
  if (!detail) return null
  return <PlaylistDetailViewInner detail={detail} onClose={onClose} bottomPadding={bottomPadding ?? 0} />
}

export default memo(PlaylistDetailView, (prev, next) => {
  return prev.detail === next.detail && prev.onClose === next.onClose && prev.bottomPadding === next.bottomPadding
})

const useLuxStyles = sharedLuxStyles(() => createStyle({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  detailContent: {
    paddingBottom: 0,
    paddingHorizontal: PAGE_GUTTER,
  },
  detailListWrap: {
    flex: 1,
    position: 'relative',
  },
  selectBar: {
    position: 'absolute',
    left: PAGE_GUTTER,
    right: PAGE_GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
  },
}))
