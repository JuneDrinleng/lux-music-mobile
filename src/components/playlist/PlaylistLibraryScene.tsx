import { type RefObject } from 'react'
import { Animated, ScrollView, TouchableOpacity, View, type GestureResponderEvent } from 'react-native'
import { Play } from 'lucide-react-native'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'

import Image from '@/components/common/Image'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import SegmentedIconSwitch, { type SegmentedIconSwitchItem } from '@/components/common/SegmentedIconSwitch'
import Text from '@/components/common/Text'
import { type useI18n } from '@/lang'

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
  featuredLibraryCards: FeaturedLibraryCard[]
  displayPlaylists: LX.List.UserListInfo[]
  playlistMetaMap: Record<string, { count: number, pic: string | null }>
  playlistDisplayMode: 'grid' | 'list'
  displaySwitchItems: SegmentedIconSwitchItem[]
  isPlaylistTimeSort: boolean
  playlistSortIcon: string
  isPlaylistListMode: boolean
  isPlay: boolean
  isSourceMenuVisible: boolean
  sourceMenuBackdropOpacity: Animated.AnimatedInterpolation<number>
  createListDialogRef: RefObject<PromptDialogType>
  getPlaylistCardTone: (index: number) => { surface: string, accent: string, ink: string }
  isPlaylistCurrent: (listId: string | null | undefined) => boolean
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
  featuredLibraryCards,
  displayPlaylists,
  playlistMetaMap,
  playlistDisplayMode,
  displaySwitchItems,
  isPlaylistTimeSort,
  playlistSortIcon,
  isPlaylistListMode,
  isPlay,
  isSourceMenuVisible,
  sourceMenuBackdropOpacity,
  createListDialogRef,
  getPlaylistCardTone,
  isPlaylistCurrent,
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
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 2, paddingBottom: bottomDockHeight }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.greetingBlock}>
          <Text size={30} color="#16181f" style={styles.greetingTitle}>{t('me_my_playlists')}</Text>
        </View>

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

        <View style={styles.section}>
          <View style={[styles.sectionHeader, styles.playlistSectionHeader]}>
            <View style={styles.playlistSectionTitleWrap}>
              <Text size={18} color="#111827" style={[styles.sectionTitle, styles.playlistSectionTitle]} numberOfLines={1}>{t('me_playlist_list')}</Text>
            </View>
            <View style={[styles.sectionHeaderActions, styles.playlistSectionHeaderActions]}>
              <SegmentedIconSwitch
                value={playlistDisplayMode}
                items={displaySwitchItems}
                onChange={value => { onPlaylistDisplayModeChange(value as 'grid' | 'list') }}
                style={styles.displaySwitch}
              />
              <TouchableOpacity
                activeOpacity={0.8}
                style={[styles.sectionIconBtn, isPlaylistTimeSort ? styles.sectionIconBtnActive : null]}
                onPress={onTogglePlaylistSort}
              >
                <MaterialCommunityIcon name={playlistSortIcon} size={15} color={isPlaylistTimeSort ? '#111827' : '#6b7280'} />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.sectionIconBtn}
                onPress={onShowCreateListModal}
              >
                <MaterialCommunityIcon name="plus" size={16} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={isPlaylistListMode ? styles.listPanel : styles.listGrid}>
            {displayPlaylists.length
              ? displayPlaylists.map((item, index) => {
                const tone = getPlaylistCardTone(index + 2)
                const playlistCount = playlistMetaMap[item.id]?.count ?? 0
                const isCurrentPlaylist = isPlaylistCurrent(item.id)
                return (
                  isPlaylistListMode
                    ? <TouchableOpacity key={item.id} style={[styles.listRowItem, index < displayPlaylists.length - 1 ? styles.listRowSpacing : null]} activeOpacity={0.84} onPress={() => { onOpenList(item) }}>
                        <View style={styles.listRowCoverWrap}>
                          {playlistMetaMap[item.id]?.pic
                            ? <Image style={styles.listRowCover} url={playlistMetaMap[item.id]?.pic ?? null} />
                            : <View style={[styles.listRowCover, styles.listPicFallback, { backgroundColor: tone.surface }]}>
                                <MaterialCommunityIcon name="music-note-eighth" size={20} color={tone.accent} />
                              </View>}
                        </View>
                        <View style={styles.listRowInfo}>
                          <Text size={15} color="#171a22" style={styles.listRowTitle} numberOfLines={1}>{item.name}</Text>
                          <Text size={12} color="#7d8190" style={styles.listRowSubtitle} numberOfLines={1}>{t('home_daily_tracks', { count: playlistCount })}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.listRowPlayButton}
                          activeOpacity={0.82}
                          onPress={onPlayPlaylistPress(item.id)}
                        >
                          {isCurrentPlaylist && isPlay
                            ? <View style={styles.pauseGlyphSmall}>
                                <View style={[styles.pauseBar, styles.pauseBarSmall, styles.pauseBarDark]} />
                                <View style={[styles.pauseBar, styles.pauseBarSmall, styles.pauseBarDark]} />
                              </View>
                            : <Play size={13} color="#303340" fill="#303340" strokeWidth={2} />}
                        </TouchableOpacity>
                      </TouchableOpacity>
                    : <TouchableOpacity key={item.id} style={styles.listItem} activeOpacity={0.84} onPress={() => { onOpenList(item) }}>
                        <View style={styles.listPicWrap}>
                          {playlistMetaMap[item.id]?.pic
                            ? <Image style={styles.listPic} url={playlistMetaMap[item.id]?.pic ?? null} />
                            : <View style={[styles.listPic, styles.listPicFallback, { backgroundColor: tone.surface }]}>
                                <MaterialCommunityIcon name="music-note-eighth" size={24} color={tone.accent} />
                              </View>}
                        </View>
                        <View style={styles.listInfo}>
                          <Text size={14} color="#19171c" style={styles.listTitle} numberOfLines={2}>{item.name}</Text>
                          <Text size={11} color="#7a7179">{t('me_songs_count', { num: playlistCount })}</Text>
                        </View>
                      </TouchableOpacity>
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
