/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type MutableRefObject, type RefObject, type ReactNode } from 'react'
import { ScrollView, TouchableOpacity, View, type GestureResponderEvent, type GestureResponderHandlers, type LayoutChangeEvent } from 'react-native'

import { MdiIcon } from '@/components/common/MdiIcon'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import Text from '@/components/common/Text'
import { EmptyState, MagTopBar, SectionHeader } from '@/components/magazine'
import PlaylistLibraryCard, { type PlaylistCardShiftAnims, type PlaylistDragController } from '@/components/playlist/PlaylistLibraryCard'
import { type useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'

export interface PlaylistLibrarySceneProps {
  t: ReturnType<typeof useI18n>
  statusBarHeight: number
  bottomDockHeight: number
  masthead: string
  onSearchPress: () => void
  profileHero?: ReactNode
  quickActionsRow?: ReactNode
  displayPlaylists: LX.List.UserListInfo[]
  playlistMetaMap: Record<string, { count: number, pic: string | null }>
  playlistDisplayMode: 'grid' | 'list'
  sectionMeta: string
  isPlaylistTimeSort: boolean
  playlistSortIcon: string
  isPlaylistListMode: boolean
  isPlay: boolean
  createListDialogRef: RefObject<PromptDialogType>
  isPlaylistCurrent: (listId: string | null | undefined) => boolean
  isPlaylistCustomSort?: boolean
  isPlaylistDragActive?: boolean
  draggingPlaylistId?: string | null
  playlistShiftAnimMap?: Map<string, PlaylistCardShiftAnims>
  dragControllerRef?: MutableRefObject<PlaylistDragController>
  playlistSectionRef?: RefObject<View>
  playlistScrollRef?: RefObject<ScrollView>
  onPlaylistScroll?: (event: { nativeEvent: { contentOffset: { y: number } } }) => void
  onPlaylistScrollBeginDrag?: () => void
  onPlaylistTouchMove?: (event: GestureResponderEvent) => void
  onPlaylistTouchEnd?: () => void
  onPlaylistTouchCancel?: () => void
  playlistPanHandlers?: GestureResponderHandlers
  onPlaylistScrollLayout?: (event: LayoutChangeEvent) => void
  onPlaylistContentSizeChange?: (width: number, height: number) => void
  onPlaylistCardLayout?: (itemId: string, layout: { x: number, y: number, width: number, height: number }) => void
  onPlaylistSectionLayout?: (event: LayoutChangeEvent) => void
  onOpenList: (listInfo: LX.List.MyListInfo) => void
  onPlaylistDisplayModeChange: (mode: 'grid' | 'list') => void
  onTogglePlaylistSort: () => void
  onShowCreateListModal: () => void
  onPlayPlaylistPress: (listId: string | null | undefined) => (event: GestureResponderEvent) => void
  onCreateList: (value: string) => Promise<boolean>
}

export default ({
  t,
  statusBarHeight,
  bottomDockHeight,
  masthead,
  onSearchPress,
  profileHero,
  quickActionsRow,
  displayPlaylists,
  playlistMetaMap,
  playlistDisplayMode,
  sectionMeta,
  isPlaylistTimeSort,
  playlistSortIcon,
  isPlaylistListMode,
  isPlay,
  createListDialogRef,
  isPlaylistCurrent,
  isPlaylistCustomSort,
  isPlaylistDragActive,
  draggingPlaylistId,
  playlistShiftAnimMap,
  dragControllerRef,
  playlistSectionRef,
  playlistScrollRef,
  onPlaylistScroll,
  onPlaylistScrollBeginDrag,
  onPlaylistTouchMove,
  onPlaylistTouchEnd,
  onPlaylistTouchCancel,
  playlistPanHandlers,
  onPlaylistScrollLayout,
  onPlaylistContentSizeChange,
  onPlaylistCardLayout,
  onPlaylistSectionLayout,
  onOpenList,
  onPlaylistDisplayModeChange,
  onTogglePlaylistSort,
  onShowCreateListModal,
  onPlayPlaylistPress,
  onCreateList,
}: PlaylistLibrarySceneProps) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)

  const toolbar = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      <TouchableOpacity
        activeOpacity={0.7}
        hitSlop={8}
        onPress={() => { onPlaylistDisplayModeChange('grid') }}
        accessibilityRole="button"
        accessibilityState={{ selected: playlistDisplayMode === 'grid' }}
      >
        <MdiIcon
          name="view-grid-outline"
          size={22}
          color={playlistDisplayMode === 'grid' ? r.ink : r.quiet}
        />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.7}
        hitSlop={8}
        onPress={() => { onPlaylistDisplayModeChange('list') }}
        accessibilityRole="button"
        accessibilityState={{ selected: playlistDisplayMode === 'list' }}
      >
        <MdiIcon
          name="format-list-bulleted"
          size={22}
          color={playlistDisplayMode === 'list' ? r.ink : r.quiet}
        />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.7}
        hitSlop={8}
        onPress={onTogglePlaylistSort}
        accessibilityRole="button"
      >
        <MdiIcon
          name={playlistSortIcon}
          size={22}
          color={isPlaylistCustomSort ? r.ink : isPlaylistTimeSort ? r.ink : r.quiet}
        />
      </TouchableOpacity>
      <TouchableOpacity
        activeOpacity={0.7}
        hitSlop={8}
        onPress={onShowCreateListModal}
        accessibilityRole="button"
      >
        <MdiIcon name="playlist-plus" size={22} color={r.ink} />
      </TouchableOpacity>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: r.paper }} {...playlistPanHandlers} onTouchEndCapture={onPlaylistTouchEnd}>
      <ScrollView
        ref={playlistScrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: statusBarHeight,
          paddingHorizontal: PAGE_GUTTER,
          paddingBottom: bottomDockHeight + 24,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
        scrollEnabled={!isPlaylistDragActive}
        scrollEventThrottle={16}
        onScroll={onPlaylistScroll}
        onScrollBeginDrag={onPlaylistScrollBeginDrag}
        onTouchMove={onPlaylistTouchMove}
        onTouchEnd={onPlaylistTouchEnd}
        onTouchCancel={onPlaylistTouchCancel}
        onLayout={onPlaylistScrollLayout}
        onContentSizeChange={onPlaylistContentSizeChange}
      >
        <MagTopBar
          masthead={masthead}
          trailing={
            <TouchableOpacity activeOpacity={0.7} onPress={onSearchPress} hitSlop={8} accessibilityRole="button">
              <MdiIcon name="magnify" size={24} color={r.ink} />
            </TouchableOpacity>
          }
        />

        {profileHero}

        {quickActionsRow}

        <View ref={playlistSectionRef} onLayout={onPlaylistSectionLayout} style={{ marginTop: 8 }}>
          <SectionHeader
            title={t('me_my_playlists')}
            trailing={toolbar}
            compactRule
          />
          <Text
            size={magType.sectionMeta.size}
            color={r.eyebrow}
            style={{ fontWeight: '600', letterSpacing: 1, marginTop: 6, marginBottom: 10 }}
          >
            {sectionMeta}
          </Text>

          <View style={isPlaylistListMode
            ? { width: '100%', overflow: 'visible' }
            : { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', overflow: 'visible' }}
          >
            {displayPlaylists.length
              ? displayPlaylists.map((item, index) => {
                const shiftAnims = playlistShiftAnimMap?.get(item.id)
                if (!dragControllerRef || !shiftAnims || !onPlaylistCardLayout) return null
                const playlistCount = playlistMetaMap[item.id]?.count ?? 0
                return (
                  <PlaylistLibraryCard
                    key={item.id}
                    t={t}
                    item={item}
                    index={index}
                    isListMode={isPlaylistListMode}
                    isLast={index >= displayPlaylists.length - 1}
                    count={playlistCount}
                    pic={playlistMetaMap[item.id]?.pic ?? null}
                    isCurrent={isPlaylistCurrent(item.id)}
                    isPlay={isPlay}
                    isDragging={draggingPlaylistId === item.id}
                    dragActive={Boolean(isPlaylistDragActive)}
                    shiftAnims={shiftAnims}
                    dragControllerRef={dragControllerRef}
                    onOpenList={onOpenList}
                    onPlayPress={onPlayPlaylistPress(item.id)}
                    onCardLayout={onPlaylistCardLayout}
                  />
                )
              })
              : (
                  <EmptyState
                    eyebrow="EMPTY · 0"
                    title={t('library_empty_title')}
                    message={t('library_empty_message')}
                    actionLabel={t('me_create_new')}
                    onAction={onShowCreateListModal}
                  />
                )}
          </View>
        </View>
      </ScrollView>
      <PromptDialog
        ref={createListDialogRef}
        title={t('me_create_new')}
        placeholder={t('list_create_input_placeholder')}
        confirmText={t('metadata_edit_modal_confirm')}
        cancelText={t('cancel')}
        bgHide={false}
        onConfirm={onCreateList}
      />
    </View>
  )
}
