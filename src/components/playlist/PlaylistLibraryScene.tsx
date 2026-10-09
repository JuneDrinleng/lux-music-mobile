/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type MutableRefObject, type RefObject, type ReactNode, useCallback, useMemo, useRef, useState } from 'react'
import {
  ScrollView,
  TouchableOpacity,
  View,
  type GestureResponderEvent,
  type GestureResponderHandlers,
  type LayoutChangeEvent,
} from 'react-native'

import { MdiIcon } from '@/components/common/MdiIcon'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import Text from '@/components/common/Text'
import {
  EmptyState,
  IconButton,
  MagMenu,
  MagSegmented,
  MagTopBar,
  SectionHeader,
} from '@/components/magazine'
import PlaylistLibraryCard, { type PlaylistCardShiftAnims, type PlaylistDragController } from '@/components/playlist/PlaylistLibraryCard'
import { type useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'

export type PlaylistSortMode = 'default' | 'time' | 'custom'

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
  playlistSortMode: PlaylistSortMode
  isPlaylistListMode: boolean
  isPlay: boolean
  createListDialogRef: RefObject<PromptDialogType>
  isPlaylistCurrent: (listId: string | null | undefined) => boolean
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
  onPlaylistSortChange: (mode: PlaylistSortMode) => void
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
  playlistSortMode,
  isPlaylistListMode,
  isPlay,
  createListDialogRef,
  isPlaylistCurrent,
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
  onPlaylistSortChange,
  onShowCreateListModal,
  onPlayPlaylistPress,
  onCreateList,
}: PlaylistLibrarySceneProps) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const sortAnchorRef = useRef<View>(null)
  const [sortMenuVisible, setSortMenuVisible] = useState(false)
  const [sortAnchor, setSortAnchor] = useState({ top: 120, left: 22, width: 220 })

  const viewItems = useMemo(() => ([
    { id: 'grid', label: t('library_view_grid') },
    { id: 'list', label: t('library_view_list') },
  ]), [t])

  const sortShortLabel = playlistSortMode === 'custom'
    ? t('library_sort_custom_short')
    : playlistSortMode === 'time'
      ? t('library_sort_oldest_short')
      : t('library_sort_recent_short')

  const sortMenuItems = useMemo(() => ([
    { id: 'default', label: t('library_sort_recent') },
    { id: 'time', label: t('library_sort_oldest') },
    {
      id: 'custom',
      label: t('library_sort_custom'),
      note: t('library_sort_custom_note'),
    },
  ]), [t])

  const openSortMenu = useCallback(() => {
    sortAnchorRef.current?.measureInWindow((x, y, width, height) => {
      const menuWidth = 220
      setSortAnchor({
        top: y + height + 6,
        left: Math.max(PAGE_GUTTER, x + width - menuWidth),
        width: menuWidth,
      })
      setSortMenuVisible(true)
    })
  }, [])

  const createPill = (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onShowCreateListModal}
      accessibilityRole="button"
      accessibilityLabel={t('me_create_new')}
      style={{
        minHeight: 44,
        minWidth: 44,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: r.ink,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text size={13} color={r.onInk} style={{ fontWeight: '800' }}>
        {t('library_create_new')}
      </Text>
    </TouchableOpacity>
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
            <IconButton
              name="magnify"
              accessibilityLabel={t('action_search')}
              onPress={onSearchPress}
            />
          }
        />

        {profileHero}

        {quickActionsRow}

        <View ref={playlistSectionRef} onLayout={onPlaylistSectionLayout} style={{ marginTop: 16 }}>
          <SectionHeader
            title={t('me_my_playlists')}
            trailing={createPill}
            showRule={false}
          />
          <Text
            size={magType.sectionMeta.size}
            color={r.eyebrow}
            style={{ fontWeight: '600', letterSpacing: 1, marginTop: 6, marginBottom: 10 }}
          >
            {sectionMeta}
          </Text>

          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            minHeight: 44,
            marginBottom: 12,
            gap: 10,
          }}>
            <MagSegmented
              compact
              items={viewItems}
              value={playlistDisplayMode}
              onChange={(id) => { onPlaylistDisplayModeChange(id as 'grid' | 'list') }}
              renderItem={(item, selected) => (
                <>
                  <MdiIcon
                    name={item.id === 'grid' ? 'view-grid-outline' : 'format-list-bulleted'}
                    size={16}
                    color={selected ? r.paper : r.ink}
                  />
                  <Text
                    size={13}
                    color={selected ? r.paper : r.ink}
                    style={{ fontWeight: selected ? '800' : '600' }}
                  >
                    {item.label}
                  </Text>
                </>
              )}
            />
            <TouchableOpacity
              ref={sortAnchorRef}
              activeOpacity={0.7}
              onPress={openSortMenu}
              accessibilityRole="button"
              accessibilityLabel={t('library_sort_trigger', { sort: sortShortLabel })}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: 4,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Text size={13} color={r.ink} style={{ fontWeight: '700' }}>
                {t('library_sort_trigger', { sort: sortShortLabel })}
              </Text>
              <MdiIcon name="chevron-down" size={18} color={r.ink} />
            </TouchableOpacity>
          </View>

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
      <MagMenu
        visible={sortMenuVisible}
        onClose={() => { setSortMenuVisible(false) }}
        items={sortMenuItems}
        value={playlistSortMode}
        onChange={(id) => { onPlaylistSortChange(id as PlaylistSortMode) }}
        anchor={sortAnchor}
        title={t('library_sort_menu_title')}
      />
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
