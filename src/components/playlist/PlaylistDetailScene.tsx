import { type ReactElement, type RefObject } from 'react'
import { FlatList, View, type Animated, type GestureResponderHandlers, type LayoutChangeEvent, type ListRenderItem, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'

import MusicMultiAddModal, { type MusicMultiAddModalType } from '@/components/MusicMultiAddModal'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import Text from '@/components/common/Text'
import { type useI18n } from '@/lang'
import PlaylistImportPanel from './PlaylistImportPanel'
import PlaylistSongDragOverlay from './PlaylistSongDragOverlay'

interface ImportCandidate {
  id: string
  musicInfo: LX.Music.MusicInfo
  fromListName: string
}

export interface PlaylistDetailSceneProps {
  styles: Record<string, any>
  t: ReturnType<typeof useI18n>
  bottomDockHeight: number
  modalBottomInset: number
  selectedListId: string | null
  selectedListInfo: LX.List.MyListInfo | null
  detailSongs: LX.Music.MusicInfo[]
  detailHeader: ReactElement | null
  detailLoading: boolean
  isSongDragActive: boolean
  draggingSong: LX.Music.MusicInfo | null
  dragTop: Animated.Value
  dragScale: Animated.Value
  dragOpacity: Animated.Value
  detailHeroCover: string | null
  detailListRef: RefObject<FlatList<LX.Music.MusicInfo>>
  detailListWrapRef: RefObject<View>
  detailListPanHandlers: GestureResponderHandlers
  musicMultiAddModalRef: RefObject<MusicMultiAddModalType>
  renameListDialogRef: RefObject<PromptDialogType>
  removeListDialogRef: RefObject<PromptDialogType>
  removeSongDialogRef: RefObject<PromptDialogType>
  pendingDeleteSong: LX.Music.MusicInfo | null
  isImportDrawerVisible: boolean
  importLoading: boolean
  importSubmitting: boolean
  importCandidates: ImportCandidate[]
  importSelectedMap: Record<string, true>
  areAllImportSongsSelected: boolean
  importSelectedCount: number
  renderSongItem: ListRenderItem<LX.Music.MusicInfo>
  getSongRowKey: (song: LX.Music.MusicInfo, index: number) => string
  getSourceTone: (source: string) => { text: string, background: string }
  onDetailWrapLayout: (event: LayoutChangeEvent) => void
  onDetailListScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void
  onDetailListContentSizeChange: (width: number, height: number) => void
  onCloseImportDrawer: () => void
  onImportSelectedSongs: () => void
  onToggleSelectAllImportSongs: () => void
  onToggleImportSong: (id: string) => void
  onRenameList: (value: string) => Promise<boolean>
  onRemoveSelectedList: () => Promise<boolean>
  onCancelRemoveSong: () => void
  onConfirmRemoveSong: () => Promise<boolean>
}

export default ({
  styles,
  t,
  bottomDockHeight,
  modalBottomInset,
  selectedListId,
  selectedListInfo,
  detailSongs,
  detailHeader,
  detailLoading,
  isSongDragActive,
  draggingSong,
  dragTop,
  dragScale,
  dragOpacity,
  detailHeroCover,
  detailListRef,
  detailListWrapRef,
  detailListPanHandlers,
  musicMultiAddModalRef,
  renameListDialogRef,
  removeListDialogRef,
  removeSongDialogRef,
  pendingDeleteSong,
  isImportDrawerVisible,
  importLoading,
  importSubmitting,
  importCandidates,
  importSelectedMap,
  areAllImportSongsSelected,
  importSelectedCount,
  renderSongItem,
  getSongRowKey,
  getSourceTone,
  onDetailWrapLayout,
  onDetailListScroll,
  onDetailListContentSizeChange,
  onCloseImportDrawer,
  onImportSelectedSongs,
  onToggleSelectAllImportSongs,
  onToggleImportSong,
  onRenameList,
  onRemoveSelectedList,
  onCancelRemoveSong,
  onConfirmRemoveSong,
}: PlaylistDetailSceneProps) => {
  const draggingSourceTone = draggingSong ? getSourceTone(draggingSong.source) : null

  return (
    <>
      <View
        ref={detailListWrapRef}
        style={styles.detailListWrap}
        onLayout={onDetailWrapLayout}
        collapsable={false}
        {...detailListPanHandlers}
      >
        <FlatList
          ref={detailListRef}
          style={styles.container}
          contentContainerStyle={[styles.detailContent, { paddingBottom: bottomDockHeight }]}
          data={detailSongs}
          renderItem={renderSongItem}
          keyExtractor={(item, index) => getSongRowKey(item, index)}
          ListHeaderComponent={detailHeader}
          ListEmptyComponent={(
            <View style={styles.emptyCard}>
              <Text size={13} color="#6b7280">{detailLoading ? t('me_loading_songs') : t('me_no_songs')}</Text>
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
          onScroll={onDetailListScroll}
          onContentSizeChange={onDetailListContentSizeChange}
          scrollEventThrottle={16}
          scrollEnabled={!isSongDragActive}
        />
        {draggingSong && draggingSourceTone
          ? <PlaylistSongDragOverlay
              song={draggingSong}
              sourceTone={draggingSourceTone}
              top={dragTop}
              scale={dragScale}
              opacity={dragOpacity}
              fallbackCover={detailHeroCover}
            />
          : null}
      </View>
      {selectedListId
        ? <PlaylistImportPanel
            visible={isImportDrawerVisible}
            loading={importLoading}
            submitting={importSubmitting}
            bottomInset={modalBottomInset}
            targetListName={selectedListInfo?.name}
            items={importCandidates}
            selectedMap={importSelectedMap}
            allSelected={areAllImportSongsSelected}
            cancelText={t('cancel')}
            title={t('list_import')}
            selectAllText={t('list_select_all')}
            clearSelectionText={t('list_select_cancel')}
            loadingText={t('list_loading')}
            emptyText={t('me_no_songs')}
            countText={t('me_songs_count', { num: importCandidates.length })}
            confirmText={`${t('list_add_title_first_add')}${importSelectedCount > 0 ? `(${importSelectedCount})` : ''}`}
            onClose={onCloseImportDrawer}
            onSubmit={onImportSelectedSongs}
            onToggleSelectAll={onToggleSelectAllImportSongs}
            onToggleItem={onToggleImportSong}
            getSourceTone={getSourceTone}
          />
        : null}
      {selectedListId
        ? <>
            <PromptDialog
              ref={renameListDialogRef}
              title={t('list_rename_title')}
              placeholder={t('list_create_input_placeholder')}
              confirmText={t('metadata_edit_modal_confirm')}
              cancelText={t('cancel')}
              bgHide={false}
              onConfirm={onRenameList}
            />
            <PromptDialog
              ref={removeListDialogRef}
              title={t('list_remove_tip', { name: selectedListInfo?.name ?? '' })}
              confirmText={t('list_remove_tip_button')}
              cancelText={t('cancel')}
              showInput={false}
              bgHide={false}
              onConfirm={onRemoveSelectedList}
            />
            <PromptDialog
              ref={removeSongDialogRef}
              title={t('list_remove_tip', { name: pendingDeleteSong?.name ?? '' })}
              confirmText={t('list_remove_tip_button')}
              cancelText={t('cancel')}
              showInput={false}
              bgHide={false}
              onCancel={onCancelRemoveSong}
              onHide={onCancelRemoveSong}
              onConfirm={onConfirmRemoveSong}
            />
          </>
        : null}
      <MusicMultiAddModal ref={musicMultiAddModalRef} />
    </>
  )
}
