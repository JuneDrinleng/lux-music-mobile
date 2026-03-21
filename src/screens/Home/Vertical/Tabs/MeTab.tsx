import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Keyboard, ScrollView, TextInput, TouchableOpacity, View, type ListRenderItem } from 'react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import { confirmDialog, createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { useMyList } from '@/store/list/hook'
import { addListMusics, createList, getListMusics, removeListMusics, setActiveList } from '@/core/list'
import { playList } from '@/core/player/player'
import { LIST_IDS } from '@/config/constant'
import { getUserAvatar, getUserName } from '@/utils/data'
import { search as searchOnlineMusic } from '@/core/search/music'
import settingState from '@/store/setting/state'
import { type Source as OnlineSearchSource } from '@/store/search/music/state'
import { useI18n } from '@/lang'
import listState from '@/store/list/state'

const SHOW_LISTENING_STATISTICS = false
const DEFAULT_AVATAR = 'https://lh3.googleusercontent.com/aida-public/AB6AXuAcVca8jY8f-JP2fdUKrHa_XFfVv4N77gpir_i1Q-OurG6uswWSse3yJNJJbZGpnM2tQ050EHA3ZGui2TJgYQCuiLjFgMR3sGA7R602hWmDCqTJ0ABPvqfNVwgSqTKgeY9ojtsoEXx1hi-SmEyE_lTXJnzVRT-XoPMSwq82IZLvnaOAg4IVTJ5Y1lKuksGcqjxLc448H-n0G9AlKAO0ZvRn-jqY3boR70xtpI1fJo8ou-0ZtR-AkL9CmhAzGR0K9nPhk-rt5yI7-tE'
const DEFAULT_USER_NAME = 'Alex Rivera'
const sourceMenus = [
  { action: 'all', label: 'all' },
  { action: 'kg', label: 'kg' },
  { action: 'kw', label: 'kw' },
  { action: 'mg', label: 'mg' },
  { action: 'tx', label: 'tx' },
  { action: 'wy', label: 'wy' },
] as const

type SourceMenu = typeof sourceMenus[number]
type SearchResultItem = LX.Music.MusicInfoOnline

const stats: Array<{ day: string, height: `${number}%`, active?: boolean }> = [
  { day: 'Mon', height: '40%' },
  { day: 'Tue', height: '65%' },
  { day: 'Wed', height: '85%' },
  { day: 'Thu', height: '50%', active: true },
  { day: 'Fri', height: '70%' },
  { day: 'Sat', height: '95%' },
  { day: 'Sun', height: '30%' },
]

export default () => {
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const headerTopPadding = statusBarHeight + 8
  const headerHeight = headerTopPadding + 46 + 8
  const playlists = useMyList()
  const [playlistMetaMap, setPlaylistMetaMap] = useState<Record<string, { count: number, pic: string | null }>>({})
  const [selectedListId, setSelectedListId] = useState<string | null>(null)
  const [detailSongs, setDetailSongs] = useState<LX.Music.MusicInfo[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string>(DEFAULT_AVATAR)
  const [userName, setUserName] = useState<string>(DEFAULT_USER_NAME)
  const [searchText, setSearchText] = useState('')
  const [searchSource, setSearchSource] = useState<SourceMenu['action']>('all')
  const [isSourceMenuVisible, setSourceMenuVisible] = useState(false)
  const [isSearchMode, setSearchMode] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
  const [lovedSongMap, setLovedSongMap] = useState<Record<string, true>>({})
  const [isSearchInputEditing, setSearchInputEditing] = useState(false)
  const detailRequestIdRef = useRef(0)
  const searchRequestIdRef = useRef(0)
  const searchInputRef = useRef<TextInput>(null)
  const musicAddModalRef = useRef<MusicAddModalType>(null)
  const createListDialogRef = useRef<PromptDialogType>(null)
  const setKeepPlayBarVisible = (visible: boolean) => {
    Reflect.set(global.lx, 'keepPlayBarOnKeyboard', visible)
  }
  const lovePlaylist = useMemo(() => playlists.find(list => list.id === LIST_IDS.LOVE) ?? null, [playlists])
  const displayPlaylists = useMemo(() => playlists.filter(list => list.id !== LIST_IDS.LOVE), [playlists])
  const likedSongsCount = lovePlaylist ? playlistMetaMap[lovePlaylist.id]?.count ?? 0 : 0

  useEffect(() => {
    return () => {
      setKeepPlayBarVisible(false)
    }
  }, [])

  const pickCover = (list: LX.Music.MusicInfo[]) => {
    for (const song of list) {
      if (song.meta.picUrl) return song.meta.picUrl
    }
    return null
  }

  const updatePlaylistMeta = useCallback(async(ids: string[]) => {
    if (!ids.length) return
    const result = await Promise.all(ids.map(async(id) => {
      const list = await getListMusics(id)
      return {
        id,
        count: list.length,
        pic: pickCover(list),
      }
    }))
    setPlaylistMetaMap((prev) => {
      const next = { ...prev }
      for (const item of result) {
        next[item.id] = {
          count: item.count,
          pic: item.pic,
        }
      }
      return next
    })
  }, [])

  const loadDetailSongs = useCallback(async(id: string, showLoading = false) => {
    const requestId = ++detailRequestIdRef.current
    if (showLoading) setDetailLoading(true)
    const list = await getListMusics(id)
    if (requestId !== detailRequestIdRef.current) return
    setDetailSongs([...list])
    if (showLoading) setDetailLoading(false)
  }, [])

  const refreshLovedSongMap = useCallback(async() => {
    const list = await getListMusics(LIST_IDS.LOVE)
    const next: Record<string, true> = {}
    for (const song of list) {
      next[String(song.id)] = true
    }
    setLovedSongMap(next)
  }, [])

  useEffect(() => {
    void updatePlaylistMeta(playlists.map(list => list.id))
    if (selectedListId && !playlists.some(list => list.id === selectedListId)) {
      setSelectedListId(null)
      setDetailSongs([])
    }
  }, [playlists, selectedListId, updatePlaylistMeta])

  useEffect(() => {
    void refreshLovedSongMap()
  }, [refreshLovedSongMap])

  useEffect(() => {
    let isUnmounted = false
    void getUserAvatar().then((path) => {
      if (isUnmounted) return
      setAvatarUrl(path ?? DEFAULT_AVATAR)
    })

    const handleAvatarUpdate = (path: string | null) => {
      setAvatarUrl(path ?? DEFAULT_AVATAR)
    }
    global.app_event.on('userAvatarUpdated', handleAvatarUpdate)

    return () => {
      isUnmounted = true
      global.app_event.off('userAvatarUpdated', handleAvatarUpdate)
    }
  }, [])

  useEffect(() => {
    let isUnmounted = false
    void getUserName().then((name) => {
      if (isUnmounted) return
      setUserName(name ?? DEFAULT_USER_NAME)
    })

    const handleNameUpdate = (name: string) => {
      setUserName(name.trim() ? name : DEFAULT_USER_NAME)
    }
    global.app_event.on('userNameUpdated', handleNameUpdate)

    return () => {
      isUnmounted = true
      global.app_event.off('userNameUpdated', handleNameUpdate)
    }
  }, [])

  useEffect(() => {
    const handleMusicUpdate = (ids: string[]) => {
      void updatePlaylistMeta(ids)
      if (ids.includes(LIST_IDS.LOVE)) void refreshLovedSongMap()
      if (selectedListId && ids.includes(selectedListId)) {
        void loadDetailSongs(selectedListId)
      }
    }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleMusicUpdate)
    }
  }, [loadDetailSongs, refreshLovedSongMap, selectedListId, updatePlaylistMeta])

  const handleOpenList = (list: LX.List.MyListInfo) => {
    setSelectedListId(list.id)
    setDetailSongs([])
    void loadDetailSongs(list.id, true)
  }

  const handlePlaySong = useCallback(async(listId: string, song: LX.Music.MusicInfo, fallbackIndex: number) => {
    setActiveList(listId)
    const latestList = await getListMusics(listId)
    let targetIndex = latestList.findIndex(item => item.id === song.id && item.source === song.source)
    if (targetIndex < 0) targetIndex = latestList.findIndex(item => item.id === song.id)
    if (targetIndex < 0) targetIndex = fallbackIndex
    if (targetIndex < 0) return
    await playList(listId, targetIndex)
  }, [])
  const handlePlaySearchSong = useCallback(async(song: LX.Music.MusicInfoOnline) => {
    await addListMusics(LIST_IDS.DEFAULT, [song], settingState.setting['list.addMusicLocationType'])
    const latestList = await getListMusics(LIST_IDS.DEFAULT)
    let targetIndex = latestList.findIndex(item => item.id === song.id && item.source === song.source)
    if (targetIndex < 0) targetIndex = latestList.findIndex(item => item.id === song.id)
    if (targetIndex < 0) return
    setActiveList(LIST_IDS.DEFAULT)
    await playList(LIST_IDS.DEFAULT, targetIndex)
  }, [])
  const handleToggleSearchLoved = useCallback(async(song: LX.Music.MusicInfoOnline) => {
    const songId = String(song.id)
    const isLoved = Boolean(lovedSongMap[songId])
    setLovedSongMap((prev) => {
      const next = { ...prev }
      if (isLoved) delete next[songId]
      else next[songId] = true
      return next
    })
    try {
      if (isLoved) await removeListMusics(LIST_IDS.LOVE, [songId])
      else await addListMusics(LIST_IDS.LOVE, [song], settingState.setting['list.addMusicLocationType'])
    } catch {
      setLovedSongMap((prev) => {
        const next = { ...prev }
        if (isLoved) next[songId] = true
        else delete next[songId]
        return next
      })
    }
  }, [lovedSongMap])
  const handleShowMusicAddModal = useCallback((song: LX.Music.MusicInfoOnline) => {
    musicAddModalRef.current?.show({
      musicInfo: song,
      listId: '',
      isMove: false,
    })
  }, [])
  const handleShowCreateListModal = useCallback(() => {
    createListDialogRef.current?.show('')
  }, [])
  const handleCreateList = useCallback(async(name: string) => {
    if (!name) return false
    const isDuplicated = listState.userList.some(list => list.name == name)
    if (isDuplicated) {
      const shouldContinue = await confirmDialog({
        message: t('list_duplicate_tip'),
      })
      if (!shouldContinue) return false
    }
    await createList({ name })
    return true
  }, [t])
  const selectedListInfo = selectedListId ? playlists.find(list => list.id === selectedListId) ?? null : null
  const selectedListMeta = selectedListInfo ? playlistMetaMap[selectedListInfo.id] : null
  const renderSongItem: ListRenderItem<LX.Music.MusicInfo> = useCallback(({ item, index }) => {
    if (!selectedListId) return null
    return (
      <TouchableOpacity
        style={styles.songItem}
        activeOpacity={0.8}
        onPress={() => { void handlePlaySong(selectedListId, item, index) }}
      >
        <Image style={styles.songPic} url={item.meta.picUrl ?? null} />
        <View style={styles.songInfo}>
          <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{item.name}</Text>
          <View style={styles.songMetaRow}>
            <Text size={10} color="#7f0df2" style={styles.songSource}>{item.source.toUpperCase()}</Text>
            <Text size={11} color="#6b7280" numberOfLines={1}>{item.singer}</Text>
          </View>
        </View>
        <Text size={11} color="#9ca3af">{item.interval ?? '--:--'}</Text>
      </TouchableOpacity>
    )
  }, [handlePlaySong, selectedListId])
  const detailHeader = useMemo(() => {
    if (!selectedListInfo) return null
    return (
      <>
        <View style={[styles.header, { paddingTop: statusBarHeight + 8 }]}>
          <TouchableOpacity style={styles.detailBackBtn} activeOpacity={0.8} onPress={() => { setSelectedListId(null) }}>
            <Icon name="chevron-left" rawSize={20} color="#111827" />
          </TouchableOpacity>
        </View>

        <View style={styles.detailHero}>
          <Image style={styles.detailHeroCover} url={selectedListMeta?.pic ?? null} />
          <View style={styles.detailHeroText}>
            <Text size={22} color="#111827" style={styles.profileName} numberOfLines={1}>{selectedListInfo.name}</Text>
            <Text size={12} color="#6b7280">{t('me_songs_count', { num: selectedListMeta?.count ?? 0 })}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text size={18} color="#111827" style={styles.sectionTitle}>{t('me_songs')}</Text>
          </View>
        </View>
      </>
    )
  }, [selectedListInfo, selectedListMeta?.pic, selectedListMeta?.count, statusBarHeight, t])

  const handleSelectSource = useCallback((action: SourceMenu['action']) => {
    setSearchSource(action)
    setSourceMenuVisible(false)
  }, [])
  const toggleSourceMenu = useCallback(() => {
    setSourceMenuVisible((visible) => !visible)
  }, [])
  const searchSourceLabel = useMemo(() => {
    const target = sourceMenus.find(item => item.action === searchSource)
    return target?.label ?? 'kw'
  }, [searchSource])
  const forceDismissSearchInput = useCallback(() => {
    searchInputRef.current?.blur()
    Keyboard.dismiss()
  }, [])

  const runSearch = useCallback(async(keyword: string, source: SourceMenu['action']) => {
    const requestId = ++searchRequestIdRef.current
    setSearchLoading(true)
    try {
      const lowerKeyword = keyword.trim().toLowerCase()
      if (!lowerKeyword) {
        if (requestId !== searchRequestIdRef.current) return
        setSearchResults([])
        return
      }
      const results = await searchOnlineMusic(lowerKeyword, 1, source as OnlineSearchSource)
      if (requestId !== searchRequestIdRef.current) return
      setSearchResults(results)
    } catch {
      if (requestId !== searchRequestIdRef.current) return
      setSearchResults([])
    } finally {
      if (requestId === searchRequestIdRef.current) setSearchLoading(false)
    }
  }, [])

  const handleSubmitSearch = useCallback((text: string) => {
    forceDismissSearchInput()
    const input = (text || searchText).trim()
    setSearchText(text || searchText)
    setSearchInputEditing(false)

    if (!input) {
      setSearchMode(false)
      setSearchKeyword('')
      setSearchResults([])
      setSourceMenuVisible(false)
      forceDismissSearchInput()
      return
    }

    setSearchKeyword(input)
    setSearchMode(true)
    setSearchResults([])
    setSourceMenuVisible(false)
    void runSearch(input, searchSource)
    forceDismissSearchInput()
  }, [forceDismissSearchInput, runSearch, searchSource, searchText])

  const handleEnterSearchMode = useCallback(() => {
    setSearchMode(true)
    setSourceMenuVisible(false)
    setKeepPlayBarVisible(false)
    setSearchInputEditing(true)
  }, [])

  const handleExitSearch = useCallback(() => {
    setSearchMode(false)
    setSearchInputEditing(false)
    setSearchKeyword('')
    setSearchResults([])
    setSourceMenuVisible(false)
    forceDismissSearchInput()
  }, [forceDismissSearchInput])

  useEffect(() => {
    if (!isSearchMode || !searchKeyword) return
    void runSearch(searchKeyword, searchSource)
  }, [isSearchMode, searchKeyword, searchSource, runSearch])
  const handleBeginSearchInputEdit = useCallback(() => {
    setSearchInputEditing(true)
    setSourceMenuVisible(false)
  }, [])
  const renderSearchResultItem: ListRenderItem<SearchResultItem> = useCallback(({ item }) => {
    const isLoved = Boolean(lovedSongMap[String(item.id)])
    return (
      <View style={styles.songItem}>
        <TouchableOpacity
          style={styles.songMain}
          activeOpacity={0.8}
          onPress={() => { void handlePlaySearchSong(item) }}
        >
          <Image style={styles.songPic} url={item.meta.picUrl ?? null} />
          <View style={styles.songInfo}>
            <Text size={14} color="#111827" style={styles.listTitle} numberOfLines={1}>{item.name}</Text>
            <View style={styles.songMetaRow}>
              <Text size={10} color="#7f0df2" style={styles.songSource}>{item.source.toUpperCase()}</Text>
              <Text size={11} color="#6b7280" numberOfLines={1}>{item.singer}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.searchSongActions}>
          <Text size={11} color="#9ca3af" style={styles.searchSongInterval}>{item.interval ?? '--:--'}</Text>
          <TouchableOpacity style={styles.songActionBtn} activeOpacity={0.8} onPress={() => { void handleToggleSearchLoved(item) }}>
            {isLoved
              ? <Text size={17} color="#ef4444" style={styles.searchLoveFilled}>{'\u2665'}</Text>
              : <Icon name="love" rawSize={17} color="#9ca3af" />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.songActionBtn} activeOpacity={0.8} onPress={() => { handleShowMusicAddModal(item) }}>
            <Text size={18} color="#9ca3af" style={styles.searchAddText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }, [handlePlaySearchSong, handleShowMusicAddModal, handleToggleSearchLoved, lovedSongMap])

  const searchHeader = useMemo(() => {
    return (
      <View style={[styles.searchResultHeader, { paddingTop: statusBarHeight + 8 }]}>
        <View style={styles.searchResultRow}>
          <TouchableOpacity style={styles.detailBackBtn} activeOpacity={0.8} onPress={handleExitSearch}>
            <Icon name="chevron-left" rawSize={20} color="#111827" />
          </TouchableOpacity>
          <View style={styles.searchResultSearchWrap}>
            <View style={styles.searchWrap}>
              <Icon name="search-2" rawSize={18} color="#9ca3af" />
              {isSearchInputEditing
                ? <TextInput
                    ref={searchInputRef}
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                    disableFullscreenUI
                    blurOnSubmit
                    autoFocus
                    onBlur={() => { setSearchInputEditing(false) }}
                    onSubmitEditing={({ nativeEvent }) => { handleSubmitSearch(nativeEvent.text ?? searchText) }}
                    returnKeyType="search"
                    placeholder={t('me_search_placeholder')}
                    placeholderTextColor="#9ca3af"
                  />
                : <TouchableOpacity style={styles.searchInputDisplay} activeOpacity={0.85} onPress={handleBeginSearchInputEdit}>
                    <Text size={13} color={searchText ? '#111827' : '#9ca3af'} numberOfLines={1}>
                      {searchText || t('me_search_placeholder')}
                    </Text>
                  </TouchableOpacity>}
              <View style={styles.sourceMenuAnchor}>
                <TouchableOpacity style={styles.sourceMenuBtn} activeOpacity={0.85} onPress={toggleSourceMenu}>
                  <View style={styles.sourceCapsule}>
                    <Text size={12} color="#111827" style={styles.sourceText}>{searchSourceLabel}</Text>
                    <Icon name="chevron-right-2" rawSize={13} color="#6b7280" style={styles.sourceChevron} />
                  </View>
                </TouchableOpacity>
                {isSourceMenuVisible
                  ? <View style={[styles.sourceMenuPanelFloat, styles.searchResultSourceMenuPanelFloat]}>
                      <View style={styles.sourcePanel}>
                        {sourceMenus.map(menu => (
                          <TouchableOpacity
                            key={menu.action}
                            activeOpacity={0.85}
                            style={[styles.sourcePanelItem, menu.action === searchSource ? styles.sourcePanelItemActive : null]}
                            onPress={() => { handleSelectSource(menu.action) }}
                          >
                            <Text size={12} color={menu.action === searchSource ? '#7f0df2' : '#374151'} style={styles.sourcePanelText}>{menu.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  : null}
              </View>
            </View>
          </View>
        </View>
      </View>
    )
  }, [handleBeginSearchInputEdit, handleExitSearch, handleSelectSource, handleSubmitSearch, isSearchInputEditing, isSourceMenuVisible, searchSource, searchSourceLabel, searchText, statusBarHeight, t, toggleSourceMenu])

  if (isSearchMode) {
    return (
      <>
        <View style={styles.searchModeRoot}>
          <FlatList
            style={styles.searchResultList}
            contentContainerStyle={[styles.detailContent, styles.searchResultContent]}
            data={searchResults}
            renderItem={renderSearchResultItem}
            keyExtractor={(item, index) => `${item.id}_${item.source}_${index}`}
            ListHeaderComponent={searchHeader}
            ListHeaderComponentStyle={styles.searchResultHeaderStack}
            ListEmptyComponent={(
              <View style={styles.emptyCard}>
                <Text size={13} color="#6b7280">
                  {searchLoading
                    ? t('me_searching')
                    : searchKeyword
                      ? t('me_search_no_match')
                      : t('me_search_hint')}
                </Text>
              </View>
            )}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews={false}
            initialNumToRender={12}
            windowSize={8}
            maxToRenderPerBatch={12}
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
          />
        </View>
        <MusicAddModal ref={musicAddModalRef} />
      </>
    )
  }

  if (selectedListInfo) {
    return (
      <FlatList
        style={styles.container}
        contentContainerStyle={styles.detailContent}
        data={detailSongs}
        renderItem={renderSongItem}
        keyExtractor={(item, index) => `${item.id}_${item.source}_${index}`}
        ListHeaderComponent={detailHeader}
        ListEmptyComponent={(
          <View style={styles.emptyCard}>
            <Text size={13} color="#6b7280">{detailLoading ? t('me_loading_songs') : t('me_no_songs')}</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
        initialNumToRender={12}
        windowSize={8}
        maxToRenderPerBatch={12}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      />
    )
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, styles.headerFloating, { paddingTop: headerTopPadding }]}>
        <View style={styles.searchWrap}>
          <Icon name="search-2" rawSize={18} color="#9ca3af" />
          <TouchableOpacity style={styles.searchInputTrigger} activeOpacity={0.85} onPress={handleEnterSearchMode}>
            <Text size={13} color={searchText ? '#111827' : '#9ca3af'} numberOfLines={1}>
              {searchText || t('me_search_placeholder')}
            </Text>
          </TouchableOpacity>
          <View style={styles.sourceMenuAnchor}>
            <TouchableOpacity style={styles.sourceMenuBtn} activeOpacity={0.85} onPress={toggleSourceMenu}>
              <View style={styles.sourceCapsule}>
                <Text size={12} color="#111827" style={styles.sourceText}>{searchSourceLabel}</Text>
                <Icon name="chevron-right-2" rawSize={13} color="#6b7280" style={styles.sourceChevron} />
              </View>
            </TouchableOpacity>
            {isSourceMenuVisible
              ? <View style={styles.sourceMenuPanelFloat}>
                  <View style={styles.sourcePanel}>
                    {sourceMenus.map(menu => (
                      <TouchableOpacity
                        key={menu.action}
                        activeOpacity={0.85}
                        style={[styles.sourcePanelItem, menu.action === searchSource ? styles.sourcePanelItemActive : null]}
                        onPress={() => { handleSelectSource(menu.action) }}
                      >
                        <Text size={12} color={menu.action === searchSource ? '#7f0df2' : '#374151'} style={styles.sourcePanelText}>{menu.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              : null}
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 12 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarWrap}>
            <Image
              style={styles.avatar}
              url={avatarUrl}
            />
          </View>
          <View style={styles.profileInfo}>
            <Text size={24} color="#111827" style={styles.profileName}>{userName}</Text>
            <Text size={12} color="#6b7280">{t('me_profile_status')}</Text>
          </View>
        </View>

        <View style={styles.quickRow}>
          <TouchableOpacity
            style={styles.quickCard}
            activeOpacity={0.8}
            onPress={() => {
              if (lovePlaylist) handleOpenList(lovePlaylist)
            }}
          >
            <View style={[styles.quickIconBox, { backgroundColor: '#fee2e2' }]}>
              <Icon name="love" rawSize={18} color="#ef4444" />
            </View>
            <View style={styles.quickTextBox}>
              <Text size={13} color="#111827" style={styles.quickTitle}>{t('me_liked_songs')}</Text>
              <Text size={11} color="#6b7280">{t('me_tracks_count', { num: likedSongsCount })}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickCard, styles.quickCardLast]} activeOpacity={0.8}>
            <View style={[styles.quickIconBox, { backgroundColor: '#dbeafe' }]}>
              <Icon name="download-2" rawSize={18} color="#3b82f6" />
            </View>
            <View style={styles.quickTextBox}>
              <Text size={13} color="#111827" style={styles.quickTitle}>{t('me_local_songs')}</Text>
              <Text size={11} color="#6b7280">{t('me_tracks_count', { num: 86 })}</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text size={18} color="#111827" style={styles.sectionTitle}>{t('me_my_playlists')}</Text>
            <TouchableOpacity activeOpacity={0.8} onPress={handleShowCreateListModal}>
              <Text size={13} color="#7f0df2" style={styles.sectionTag}>{`+ ${t('me_create_new')}`}</Text>
            </TouchableOpacity>
          </View>
          <View>
            {displayPlaylists.map(item => (
              <TouchableOpacity key={item.id} style={styles.listItem} activeOpacity={0.8} onPress={() => { handleOpenList(item) }}>
                <Image style={styles.listPic} url={playlistMetaMap[item.id]?.pic ?? null} />
                <View style={styles.listInfo}>
                  <Text size={14} color="#111827" style={styles.listTitle}>{item.name}</Text>
                  <Text size={11} color="#6b7280">{t('me_songs_count', { num: playlistMetaMap[item.id]?.count ?? 0 })}</Text>
                </View>
                <Icon name="chevron-right" rawSize={16} color="#9ca3af" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {SHOW_LISTENING_STATISTICS
          ? <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text size={18} color="#111827" style={styles.sectionTitle}>Listening Statistics</Text>
                <Text size={11} color="#7f0df2" style={styles.sectionTag}>Last 7 Days</Text>
              </View>
              <View style={styles.statsCard}>
                {stats.map(item => (
                  <View key={item.day} style={styles.statsCol}>
                    <View style={styles.statsBarBg}>
                      <View style={[styles.statsBar, { height: item.height, opacity: item.active ? 1 : 0.45 }]} />
                    </View>
                    <Text size={10} color={item.active ? '#111827' : '#9ca3af'} style={item.active ? styles.dayActive : styles.day}>
                      {item.day}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          : null}
      </ScrollView>
      <PromptDialog
        ref={createListDialogRef}
        title={t('me_create_new')}
        placeholder={t('list_create_input_placeholder')}
        confirmText={t('metadata_edit_modal_confirm')}
        cancelText={t('cancel')}
        bgHide={false}
        onConfirm={async(value) => handleCreateList(value)}
      />
      </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  content: {
    paddingBottom: 0,
  },
  scroll: {
    flex: 1,
  },
  detailContent: {
    paddingBottom: 0,
    paddingHorizontal: 16,
  },
  header: {
    position: 'relative',
    overflow: 'visible',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchResultHeader: {
    position: 'relative',
    overflow: 'visible',
    paddingBottom: 8,
  },
  searchResultHeaderStack: {
    zIndex: 60,
    elevation: 20,
  },
  searchResultRow: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultSearchWrap: {
    flex: 1,
    marginLeft: 10,
  },
  searchResultList: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  searchModeRoot: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  searchResultContent: {
    paddingBottom: 16,
  },
  headerFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 6,
    backgroundColor: '#f8f9fa',
  },
  detailBackBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#f1f1f3',
  },
  searchWrap: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'visible',
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    color: '#111827',
    fontSize: 13,
    paddingVertical: 0,
  },
  searchInputDisplay: {
    flex: 1,
    marginLeft: 8,
    justifyContent: 'center',
    height: '100%',
  },
  searchInputTrigger: {
    flex: 1,
    marginLeft: 8,
    height: '100%',
    justifyContent: 'center',
  },
  sourceMenuAnchor: {
    position: 'relative',
    marginLeft: 8,
    zIndex: 40,
  },
  sourceMenuBtn: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  sourceCapsule: {
    height: 28,
    minWidth: 62,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceText: {
    fontWeight: '600',
  },
  sourceChevron: {
    marginLeft: 2,
    transform: [{ rotate: '90deg' }],
  },
  sourcePanel: {
    alignSelf: 'flex-end',
    width: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  sourceMenuPanelFloat: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 8,
    zIndex: 80,
    elevation: 24,
  },
  searchResultSourceMenuPanelFloat: {
    marginTop: 2,
  },
  sourcePanelItem: {
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourcePanelItemActive: {
    backgroundColor: '#f5f3ff',
  },
  sourcePanelText: {
    fontWeight: '600',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  avatarWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#7f0df2',
    padding: 3,
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 39,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontWeight: '700',
    marginBottom: 2,
  },
  quickRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  quickCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  quickCardLast: {
    marginRight: 0,
  },
  quickIconBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTextBox: {
    marginLeft: 8,
    flex: 1,
  },
  quickTitle: {
    fontWeight: '600',
    marginBottom: 2,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detailHero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  detailHeroCover: {
    width: 88,
    height: 88,
    borderRadius: 12,
  },
  detailHeroText: {
    flex: 1,
    marginLeft: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  sectionTag: {
    fontWeight: '500',
  },
  statsCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    padding: 12,
    height: 184,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  statsCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
  },
  statsBarBg: {
    width: '74%',
    flex: 1,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    backgroundColor: '#f3e8ff',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  statsBar: {
    width: '100%',
    backgroundColor: '#7f0df2',
  },
  day: {
    marginTop: 8,
  },
  dayActive: {
    marginTop: 8,
    fontWeight: '700',
  },
  listItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  listPic: {
    width: 58,
    height: 58,
    borderRadius: 8,
  },
  listInfo: {
    flex: 1,
    marginLeft: 10,
  },
  listTitle: {
    fontWeight: '500',
    marginBottom: 2,
  },
  songItem: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  songMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  songPic: {
    width: 50,
    height: 50,
    borderRadius: 8,
  },
  songInfo: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  songMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  songSource: {
    borderRadius: 10,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#f3e8ff',
    marginRight: 6,
    fontWeight: '600',
  },
  searchSongActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  searchSongInterval: {
    marginRight: 4,
    minWidth: 38,
    textAlign: 'right',
  },
  songActionBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchLoveFilled: {
    lineHeight: 18,
    fontWeight: '700',
  },
  searchAddText: {
    lineHeight: 19,
    fontWeight: '700',
  },
  emptyCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f1f1f3',
    backgroundColor: '#ffffff',
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
