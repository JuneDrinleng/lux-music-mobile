import { type MutableRefObject, type RefObject, type ReactNode } from 'react'
import { Animated, Image as RNImage, ScrollView, TouchableOpacity, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'

import Image from '@/components/common/Image'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import { type SegmentedIconSwitchItem } from '@/components/common/SegmentedIconSwitch'
import Text from '@/components/common/Text'
import { type useI18n } from '@/lang'
import PlaylistLibraryCard, { type PlaylistCardShiftAnims, type PlaylistDragController } from '@/components/playlist/PlaylistLibraryCard'

interface FeaturedLibraryCard {
  id: string
  list: LX.List.MyListInfo
  icon: string
  title: string
  count: number
  cover: string | null
}

export interface PlaylistLibrarySceneProps {
  styles: Record<string, any>
  t: ReturnType<typeof useI18n>
  headerHeight: number
  bottomDockHeight: number
  profileHero?: ReactNode
  quickActionsRow?: ReactNode
  hideGreeting?: boolean
  featuredLibraryCards: FeaturedLibraryCard[]
  displayPlaylists: LX.List.UserListInfo[]
  playlistMetaMap: Record<string, { count: number, pic: string | null }>
  playlistDisplayMode: 'grid' | 'list'
  displaySwitchItems: SegmentedIconSwitchItem[]
  isPlaylistTimeSort: boolean
  playlistSortIcon: number
  playlistAddIcon: number
  isPlaylistListMode: boolean
  isPlay: boolean
  isSourceMenuVisible: boolean
  sourceMenuBackdropOpacity: Animated.AnimatedInterpolation<number>
  createListDialogRef: RefObject<PromptDialogType>
  getPlaylistCardTone: (index: number) => { surface: string, accent: string, ink: string }
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
  onPlaylistScrollLayout?: (event: LayoutChangeEvent) => void
  onPlaylistContentSizeChange?: (width: number, height: number) => void
  onPlaylistCardLayout?: (itemId: string, layout: { x: number, y: number, width: number, height: number }) => void
  onPlaylistSectionLayout?: (event: LayoutChangeEvent) => void
  onCloseSourceMenu: () => void
  onOpenList: (listInfo: LX.List.MyListInfo) => void
  onPlaylistDisplayModeChange: (mode: 'grid' | 'list') => void
  onTogglePlaylistSort: () => void
  onShowCreateListModal: () => void
  onPlayPlaylistPress: (listId: string | null | undefined) => (event: GestureResponderEvent) => void
  onCreateList: (value: string) => Promise<boolean>
}

export default ({
  styles,
  t,
  headerHeight,
  bottomDockHeight,
  profileHero,
  quickActionsRow,
  hideGreeting,
  featuredLibraryCards,
  displayPlaylists,
  playlistMetaMap,
  playlistDisplayMode,
  displaySwitchItems,
  isPlaylistTimeSort,
  playlistSortIcon,
  playlistAddIcon,
  isPlaylistListMode,
  isPlay,
  isSourceMenuVisible,
  sourceMenuBackdropOpacity,
  createListDialogRef,
  getPlaylistCardTone,
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
  onPlaylistScrollLayout,
  onPlaylistContentSizeChange,
  onPlaylistCardLayout,
  onPlaylistSectionLayout,
  onCloseSourceMenu,
  onOpenList,
  onPlaylistDisplayModeChange,
  onTogglePlaylistSort,
  onShowCreateListModal,
  onPlayPlaylistPress,
  onCreateList,
}: PlaylistLibrarySceneProps) => {
  return (
    <View style={styles.container}>
      {isSourceMenuVisible
        ? <Animated.View style={[styles.sourceMenuPageBackdropWrap, styles.sourceMenuBackdrop, { opacity: sourceMenuBackdropOpacity }]}>
            <TouchableOpacity style={styles.sourceMenuPageBackdrop} activeOpacity={1} onPress={onCloseSourceMenu} />
          </Animated.View>
        : null}
      <ScrollView
        ref={playlistScrollRef}
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 2, paddingBottom: bottomDockHeight }]}
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
        onTouchCancel={onPlaylistTouchEnd}
        onLayout={onPlaylistScrollLayout}
        onContentSizeChange={onPlaylistContentSizeChange}
      >
        {profileHero}

        {quickActionsRow}

        {!hideGreeting
          ? <View style={styles.greetingBlock}>
              <Text size={30} color="#16181f" style={styles.greetingTitle}>{t('me_my_playlists')}</Text>
            </View>
          : null}

        <View style={styles.quickRow}>
          {featuredLibraryCards.map((card, index) => {
            const tone = getPlaylistCardTone(index)
            return (
              <TouchableOpacity
                key={card.id}
                style={[
                  styles.quickCard,
                  { backgroundColor: tone.surface },
                  index === featuredLibraryCards.length - 1 ? styles.quickCardLast : null,
                ]}
                activeOpacity={0.86}
                onPress={() => { onOpenList(card.list) }}
              >
                <View style={styles.quickMedia}>
                  {card.cover
                    ? <Image style={styles.quickMediaImage} url={card.cover} />
                    : <View style={[styles.quickMediaImage, styles.listPicFallback, { backgroundColor: tone.surface }]}>
                        <MaterialCommunityIcon name={card.icon} size={24} color={tone.accent} />
                      </View>}
                </View>
                <View style={styles.quickInfo}>
                  <Text size={15} color="#1c1c1e" style={styles.quickTitle} numberOfLines={1}>{card.title}</Text>
                  <View style={styles.quickMetaRow}>
                    <MaterialCommunityIcon name={card.icon} size={12} color={tone.accent} />
                    <Text size={12} color="#8e8e93" style={styles.quickMeta}>{t('me_tracks_count', { num: card.count })}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            )
          })}
        </View>

        <View ref={playlistSectionRef} style={styles.section} onLayout={onPlaylistSectionLayout}>
          <View style={[styles.sectionHeader, styles.playlistSectionHeader]}>
            <View style={styles.playlistSectionTitleWrap}>
              <Text size={18} color="#111827" style={[styles.sectionTitle, styles.playlistSectionTitle]} numberOfLines={1}>{t('me_playlist_list')}</Text>
            </View>
            <View style={[styles.sectionHeaderActions, styles.playlistSectionHeaderActions]}>
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.sectionIconBtn, isPlaylistTimeSort ? styles.sectionIconBtnActive : null]}
                onPress={onTogglePlaylistSort}
              >
                <RNImage source={playlistSortIcon} style={[styles.sortIconImg, { tintColor: isPlaylistCustomSort ? '#111827' : isPlaylistTimeSort ? '#111827' : '#6b7280' }]} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.sectionIconBtn}
                onPress={onShowCreateListModal}
              >
                <RNImage source={playlistAddIcon} style={[styles.sortIconImg, { tintColor: '#111827' }]} />
              </TouchableOpacity>
            </View>
          </View>
          <View style={isPlaylistListMode ? styles.listPanel : styles.listGrid}>
            {displayPlaylists.length
              ? displayPlaylists.map((item, index) => {
                const shiftAnims = playlistShiftAnimMap?.get(item.id)
                if (!dragControllerRef || !shiftAnims || !onPlaylistCardLayout) return null
                const tone = getPlaylistCardTone(index + 2)
                const playlistCount = playlistMetaMap[item.id]?.count ?? 0
                return (
                  <PlaylistLibraryCard
                    key={item.id}
                    styles={styles}
                    t={t}
                    item={item}
                    index={index}
                    isListMode={isPlaylistListMode}
                    isLast={index >= displayPlaylists.length - 1}
                    tone={tone}
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
              : <View style={[styles.emptyCard, styles.emptyPlaylistCard]}>
                  <TouchableOpacity style={styles.emptyActionBtn} activeOpacity={0.85} onPress={onShowCreateListModal}>
                    <Text size={13} color="#19171c" style={styles.emptyActionText}>{t('me_create_new')}</Text>
                  </TouchableOpacity>
                </View>}
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
