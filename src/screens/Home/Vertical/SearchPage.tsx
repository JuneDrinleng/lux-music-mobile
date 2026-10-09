/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  FlatList,
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import {
  BackButton,
  DOCK_BASE_HEIGHT,
  EmptyState,
  MagMenu,
  RankNumber,
  Rule,
  SectionHeader,
  TextTabs,
  type MagMenuItem,
  type MagTabItem,
} from '@/components/magazine'
import SearchMusicResultRow from '@/components/search/SearchMusicResultRow'
import SearchSonglistResultRow from '@/components/search/SearchSonglistResultRow'
import { addListMusics, getListMusics, removeListMusics } from '@/core/list'
import { addMusicToQueueAndPlay } from '@/core/player/player'
import { search as searchOnlineMusic } from '@/core/search/music'
import { search as searchOnlineSonglist } from '@/core/search/songlist'
import { addHistoryWord, clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import { APP_LAYER_INDEX, LIST_IDS } from '@/config/constant'
import { useI18n, type Message } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import searchMusicState, { type Source as OnlineSearchSource } from '@/store/search/music/state'
import searchSonglistState, { type Source as OnlineSonglistSearchSource } from '@/store/search/songlist/state'
import settingState from '@/store/setting/state'
import { type ListInfoItem as SearchSonglistItem } from '@/store/songlist/state'
import { type VerticalSearchPagePayload, type VerticalSearchSource } from '@/event/appEvent'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { createStyle } from '@/utils/tools'
import { debounce } from '@/utils'
import musicSdk from '@/utils/musicSdk'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, SECTION_TO_LIST, magType } from '@/theme/magazineType'

type SearchResultItem = LX.Music.MusicInfoOnline
type SearchResultType = 'music' | 'songlist'
type PageSearchSource = VerticalSearchSource

const SOURCE_OPTIONS: readonly PageSearchSource[] = ['all', 'kw', 'kg', 'tx', 'wy', 'mg']

const sourceShortKey = (source: string): keyof Message => {
  switch (source) {
    case 'kw': return 'source_short_kw'
    case 'kg': return 'source_short_kg'
    case 'tx': return 'source_short_tx'
    case 'wy': return 'source_short_wy'
    case 'mg': return 'source_short_mg'
    default: return `source_real_${source}` as keyof Message
  }
}

export interface SearchPageRequest extends VerticalSearchPagePayload {
  token: number
}

export default function SearchPage({
  visible,
  request,
  onClose,
}: {
  visible: boolean
  request: SearchPageRequest | null
  onClose: () => void
}) {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)

  const t = useI18n()
  const { width } = useWindowDimensions()
  const statusBarHeight = useStatusbarHeight()
  const gestureInsetBottom = useSystemGestureInsetBottom()
  const defaultSearchSource = useSettingValue('search.defaultSource') as PageSearchSource
  const [pageSearchSource, setPageSearchSource] = useState<PageSearchSource>(defaultSearchSource ?? 'all')
  const [searchText, setSearchText] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchResultType, setSearchResultType] = useState<SearchResultType>('music')
  const [searchLoading, setSearchLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [musicSearchResults, setMusicSearchResults] = useState<SearchResultItem[]>([])
  const [songlistSearchResults, setSonglistSearchResults] = useState<SearchSonglistItem[]>([])
  const [musicTotal, setMusicTotal] = useState(0)
  const [songlistTotal, setSonglistTotal] = useState(0)
  const [musicPage, setMusicPage] = useState(1)
  const [songlistPage, setSonglistPage] = useState(1)
  const [lovedSongMap, setLovedSongMap] = useState<Record<string, true>>({})
  const [isSearchInputEditing, setSearchInputEditing] = useState(false)
  const [searchHistoryList, setSearchHistoryList] = useState<string[]>([])
  const [searchTipList, setSearchTipList] = useState<string[]>([])
  const [hotSearchList, setHotSearchList] = useState<string[]>([])
  const [searchTipLoading, setSearchTipLoading] = useState(false)
  const [sourceMenuVisible, setSourceMenuVisible] = useState(false)
  const [sourceMenuAnchor, setSourceMenuAnchor] = useState({ top: 0, left: 0, width: 168 })
  const [shouldRender, setShouldRender] = useState(visible)
  const searchRequestIdRef = useRef(0)
  const searchTipRequestIdRef = useRef(0)
  const hotSearchRequestIdRef = useRef(0)
  const searchInputRef = useRef<TextInput>(null)
  const musicAddModalRef = useRef<MusicAddModalType>(null)
  const sourceTriggerRef = useRef<View>(null)
  const requestTokenRef = useRef<number | null>(null)
  const searchLoadedKeyRef = useRef<Record<SearchResultType, string>>({
    music: '',
    songlist: '',
  })
  const pageAnim = useRef(new Animated.Value(visible ? 1 : 0)).current
  const bottomPad = DOCK_BASE_HEIGHT + gestureInsetBottom

  const sourceLabel = useMemo(() => {
    if (pageSearchSource === 'all') return t('search_source_all')
    return t(sourceShortKey(pageSearchSource))
  }, [pageSearchSource, t])

  const sourceMenuItems = useMemo((): MagMenuItem[] => (
    SOURCE_OPTIONS.map((id) => ({
      id,
      label: id === 'all' ? t('search_source_all') : t(sourceShortKey(id)),
    }))
  ), [t])

  const searchTypeTabs = useMemo((): MagTabItem[] => ([
    { id: 'music', label: t('search_type_music') },
    { id: 'songlist', label: t('search_type_songlist') },
  ]), [t])

  const forceDismissSearchInput = useCallback(() => {
    searchInputRef.current?.blur()
    Keyboard.dismiss()
  }, [])
  const resetSearchPageState = useCallback(() => {
    searchRequestIdRef.current += 1
    searchTipRequestIdRef.current += 1
    setSearchLoading(false)
    setLoadingMore(false)
    setSearchTipLoading(false)
    setSearchTipList([])
    setSearchText('')
    setSearchKeyword('')
    setSearchResultType('music')
    setMusicSearchResults([])
    setSonglistSearchResults([])
    setMusicTotal(0)
    setSonglistTotal(0)
    setMusicPage(1)
    setSonglistPage(1)
    searchLoadedKeyRef.current.music = ''
    searchLoadedKeyRef.current.songlist = ''
    setSearchInputEditing(false)
    setSourceMenuVisible(false)
    setPageSearchSource(defaultSearchSource ?? 'all')
    global.app_event.verticalSearchStateUpdated({
      keyword: '',
      source: defaultSearchSource ?? 'all',
    })
    forceDismissSearchInput()
  }, [defaultSearchSource, forceDismissSearchInput])

  const refreshLovedSongMap = useCallback(async() => {
    const list = await getListMusics(LIST_IDS.LOVE)
    const next: Record<string, true> = {}
    for (const song of list) {
      next[String(song.id)] = true
    }
    setLovedSongMap(next)
  }, [])

  useEffect(() => {
    void refreshLovedSongMap()
    const handleMusicUpdate = (ids: string[]) => {
      if (!ids.includes(LIST_IDS.LOVE)) return
      void refreshLovedSongMap()
    }
    global.app_event.on('myListMusicUpdate', handleMusicUpdate)
    return () => {
      global.app_event.off('myListMusicUpdate', handleMusicUpdate)
    }
  }, [refreshLovedSongMap])

  useEffect(() => {
    if (visible) {
      Reflect.set(global.lx, 'keepPlayBarOnKeyboard', true)
      setShouldRender(true)
      Animated.timing(pageAnim, {
        toValue: 1,
        duration: 268,
        easing: Easing.bezier(0.22, 0.84, 0.22, 1),
        useNativeDriver: true,
      }).start()
      return
    }

    Reflect.set(global.lx, 'keepPlayBarOnKeyboard', false)
    resetSearchPageState()
    Animated.timing(pageAnim, {
      toValue: 0,
      duration: 220,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setShouldRender(false)
    })
  }, [pageAnim, resetSearchPageState, visible])

  const loadSearchHistoryList = useCallback(() => {
    void getSearchHistory().then((list) => {
      setSearchHistoryList(list)
    })
  }, [])

  const loadHotSearchList = useCallback((source: PageSearchSource) => {
    const requestId = ++hotSearchRequestIdRef.current
    const sdkSource = source === 'all' ? 'kw' : source
    const api = (musicSdk as Record<string, { hotSearch?: { getList?: () => Promise<{ list?: string[] }> } } | undefined>)[sdkSource]
    const fallback = (musicSdk as Record<string, { hotSearch?: { getList?: () => Promise<{ list?: string[] }> } | undefined }>).kw
    const hotApi = api?.hotSearch?.getList ? api.hotSearch : fallback?.hotSearch
    if (!hotApi?.getList) {
      setHotSearchList([])
      return
    }
    void hotApi.getList().then((data) => {
      if (requestId !== hotSearchRequestIdRef.current) return
      const list = Array.isArray(data?.list) ? data.list : []
      setHotSearchList(
        list
          .map(item => typeof item == 'string' ? item.trim() : '')
          .filter(Boolean)
          .slice(0, 10),
      )
    }).catch(() => {
      if (requestId !== hotSearchRequestIdRef.current) return
      setHotSearchList([])
    })
  }, [])

  useEffect(() => {
    if (!visible) return
    loadHotSearchList(pageSearchSource)
  }, [loadHotSearchList, pageSearchSource, visible])

  const requestSearchTips = useMemo(() => debounce((keyword: string, source: PageSearchSource) => {
    const normalizedKeyword = keyword.trim()
    if (!normalizedKeyword) return
    const requestId = ++searchTipRequestIdRef.current
    setSearchTipLoading(true)

    const sourceSdk = (musicSdk as Record<string, { tipSearch?: { search?: (text: string) => Promise<string[]> } } | undefined>)[source]
    const kwSdk = (musicSdk as Record<string, { tipSearch?: { search?: (text: string) => Promise<string[]> } | undefined }>).kw
    const tipSearchApi = source != 'all' && sourceSdk?.tipSearch?.search ? sourceSdk.tipSearch : kwSdk?.tipSearch

    if (!tipSearchApi?.search) {
      if (requestId !== searchTipRequestIdRef.current) return
      setSearchTipList([])
      setSearchTipLoading(false)
      return
    }

    void tipSearchApi.search(normalizedKeyword).then((list) => {
      if (requestId !== searchTipRequestIdRef.current) return
      if (!Array.isArray(list)) {
        setSearchTipList([])
        return
      }
      setSearchTipList(
        list
          .map(item => typeof item == 'string' ? item.trim() : '')
          .filter(Boolean),
      )
    }).catch(() => {
      if (requestId !== searchTipRequestIdRef.current) return
      setSearchTipList([])
    }).finally(() => {
      if (requestId === searchTipRequestIdRef.current) setSearchTipLoading(false)
    })
  }, 220), [])

  const runSearch = useCallback(async(keyword: string, source: PageSearchSource, type: SearchResultType, page = 1, append = false) => {
    const requestId = ++searchRequestIdRef.current
    if (append) setLoadingMore(true)
    else setSearchLoading(true)
    const lowerKeyword = keyword.trim().toLowerCase()
    const requestKey = `${type}__${source}__${lowerKeyword}`
    try {
      if (!lowerKeyword) {
        if (requestId !== searchRequestIdRef.current) return
        if (type === 'songlist') {
          setSonglistSearchResults([])
          setSonglistTotal(0)
          setSonglistPage(1)
        } else {
          setMusicSearchResults([])
          setMusicTotal(0)
          setMusicPage(1)
        }
        searchLoadedKeyRef.current[type] = ''
        return
      }
      if (type === 'songlist') {
        const results = await searchOnlineSonglist(lowerKeyword, page, source as OnlineSonglistSearchSource)
        if (requestId !== searchRequestIdRef.current) return
        setSonglistSearchResults(prev => append ? [...prev, ...results] : results)
        setSonglistTotal(searchSonglistState.listInfos[source as OnlineSonglistSearchSource]?.total ?? results.length)
        setSonglistPage(page)
      } else {
        const results = await searchOnlineMusic(lowerKeyword, page, source as OnlineSearchSource)
        if (requestId !== searchRequestIdRef.current) return
        setMusicSearchResults(prev => append ? [...prev, ...results] : results)
        setMusicTotal(searchMusicState.listInfos[source as OnlineSearchSource]?.total ?? results.length)
        setMusicPage(page)
      }
      searchLoadedKeyRef.current[type] = requestKey
    } catch {
      if (requestId !== searchRequestIdRef.current) return
      if (!append) {
        if (type === 'songlist') {
          setSonglistSearchResults([])
          setSonglistTotal(0)
        } else {
          setMusicSearchResults([])
          setMusicTotal(0)
        }
      }
      searchLoadedKeyRef.current[type] = requestKey
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setSearchLoading(false)
        setLoadingMore(false)
      }
    }
  }, [])

  const handleClose = useCallback(() => {
    resetSearchPageState()
    onClose()
  }, [onClose, resetSearchPageState])

  const handleSearchTextChange = useCallback((text: string) => {
    setSearchText(text)
    if (!isSearchInputEditing) return
    const keyword = text.trim()
    if (!keyword) {
      searchTipRequestIdRef.current += 1
      setSearchTipLoading(false)
      setSearchTipList([])
      loadSearchHistoryList()
      return
    }
    requestSearchTips(keyword, pageSearchSource)
  }, [isSearchInputEditing, loadSearchHistoryList, pageSearchSource, requestSearchTips])

  const handleSearchInputBlur = useCallback(() => {
    requestAnimationFrame(() => {
      setSearchInputEditing(false)
    })
  }, [])

  const handleClearSearchText = useCallback(() => {
    searchRequestIdRef.current += 1
    searchTipRequestIdRef.current += 1
    setSearchLoading(false)
    setLoadingMore(false)
    setSearchTipLoading(false)
    setSearchTipList([])
    setSearchText('')
    setSearchKeyword('')
    setMusicSearchResults([])
    setSonglistSearchResults([])
    setMusicTotal(0)
    setSonglistTotal(0)
    setMusicPage(1)
    setSonglistPage(1)
    searchLoadedKeyRef.current.music = ''
    searchLoadedKeyRef.current.songlist = ''
    setSearchInputEditing(true)
    global.app_event.verticalSearchStateUpdated({
      keyword: '',
      source: pageSearchSource,
    })
    loadSearchHistoryList()
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }, [loadSearchHistoryList, pageSearchSource])

  const handleSubmitSearch = useCallback((text: string) => {
    forceDismissSearchInput()
    const input = (text || searchText).trim()
    setSearchText(text || searchText)
    setSearchInputEditing(false)
    searchTipRequestIdRef.current += 1
    setSearchTipLoading(false)
    setSearchTipList([])
    setSourceMenuVisible(false)

    if (!input) {
      setSearchKeyword('')
      setMusicSearchResults([])
      setSonglistSearchResults([])
      setMusicTotal(0)
      setSonglistTotal(0)
      searchLoadedKeyRef.current.music = ''
      searchLoadedKeyRef.current.songlist = ''
      requestAnimationFrame(() => {
        setSearchInputEditing(true)
        loadSearchHistoryList()
        searchInputRef.current?.focus()
      })
      return
    }

    setSearchKeyword(input)
    setMusicSearchResults([])
    setSonglistSearchResults([])
    setMusicTotal(0)
    setSonglistTotal(0)
    setMusicPage(1)
    setSonglistPage(1)
    searchLoadedKeyRef.current.music = ''
    searchLoadedKeyRef.current.songlist = ''
    global.app_event.verticalSearchStateUpdated({
      keyword: input,
      source: pageSearchSource,
    })
    void addHistoryWord(input)
    void runSearch(input, pageSearchSource, searchResultType, 1, false)
    forceDismissSearchInput()
  }, [forceDismissSearchInput, loadSearchHistoryList, pageSearchSource, runSearch, searchResultType, searchText])

  const handleBeginSearchInputEdit = useCallback(() => {
    setSearchInputEditing(true)
    const keyword = searchText.trim()
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    if (!keyword) {
      searchTipRequestIdRef.current += 1
      setSearchTipLoading(false)
      setSearchTipList([])
      loadSearchHistoryList()
      return
    }
    requestSearchTips(keyword, pageSearchSource)
  }, [loadSearchHistoryList, pageSearchSource, requestSearchTips, searchText])

  const handlePickSearchKeyword = useCallback((keyword: string) => {
    setSearchText(keyword)
    handleSubmitSearch(keyword)
  }, [handleSubmitSearch])

  const handleClearSearchHistoryList = useCallback(() => {
    clearHistoryList()
    setSearchHistoryList([])
  }, [])

  const handleRemoveSearchHistoryItem = useCallback((keyword: string) => {
    setSearchHistoryList((list) => {
      const index = list.indexOf(keyword)
      if (index < 0) return list
      const nextList = [...list]
      nextList.splice(index, 1)
      removeHistoryWord(index)
      return nextList
    })
  }, [])

  const handlePlaySearchSong = useCallback(async(song: LX.Music.MusicInfoOnline) => {
    await addMusicToQueueAndPlay(song)
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

  const handleOpenSonglistDetail = useCallback((item: SearchSonglistItem) => {
    global.app_event.openPlaylistDetail({
      type: 'onlineSonglist',
      id: item.id,
      source: item.source,
      name: item.name,
      author: item.author,
      img: item.img ?? null,
      desc: item.desc,
      play_count: item.play_count,
    })
  }, [])

  const handleSearchResultTypeChange = useCallback((nextValue: string) => {
    if (nextValue !== 'music' && nextValue !== 'songlist') return
    if (nextValue === searchResultType) return

    setSearchResultType(nextValue)

    if (isSearchInputEditing || !searchKeyword) return

    const normalizedKeyword = searchKeyword.trim().toLowerCase()
    const requestKey = `${nextValue}__${pageSearchSource}__${normalizedKeyword}`
    if (searchLoadedKeyRef.current[nextValue] === requestKey) return

    void runSearch(searchKeyword, pageSearchSource, nextValue, 1, false)
  }, [isSearchInputEditing, pageSearchSource, runSearch, searchKeyword, searchResultType])

  const handleSelectSource = useCallback((id: string) => {
    if (!SOURCE_OPTIONS.includes(id as PageSearchSource)) return
    const next = id as PageSearchSource
    setPageSearchSource(next)
    setSourceMenuVisible(false)
    if (searchKeyword) {
      searchLoadedKeyRef.current.music = ''
      searchLoadedKeyRef.current.songlist = ''
      global.app_event.verticalSearchStateUpdated({
        keyword: searchKeyword,
        source: next,
      })
      void runSearch(searchKeyword, next, searchResultType, 1, false)
      return
    }
    const tipKeyword = searchText.trim()
    if (tipKeyword && isSearchInputEditing) {
      requestSearchTips(tipKeyword, next)
    }
    loadHotSearchList(next)
  }, [isSearchInputEditing, loadHotSearchList, requestSearchTips, runSearch, searchKeyword, searchResultType, searchText])

  const handleOpenSourceMenu = useCallback(() => {
    sourceTriggerRef.current?.measureInWindow((x, y, w, h) => {
      const menuWidth = 168
      const left = Math.max(PAGE_GUTTER, Math.min(x + w - menuWidth, width - PAGE_GUTTER - menuWidth))
      setSourceMenuAnchor({ top: y + h + 6, left, width: menuWidth })
      setSourceMenuVisible(true)
    })
  }, [width])

  const handleLoadMore = useCallback(() => {
    if (searchLoading || loadingMore || !searchKeyword) return
    if (searchResultType === 'music') {
      if (musicSearchResults.length >= musicTotal && musicTotal > 0) return
      void runSearch(searchKeyword, pageSearchSource, 'music', musicPage + 1, true)
      return
    }
    if (songlistSearchResults.length >= songlistTotal && songlistTotal > 0) return
    void runSearch(searchKeyword, pageSearchSource, 'songlist', songlistPage + 1, true)
  }, [
    loadingMore,
    musicPage,
    musicSearchResults.length,
    musicTotal,
    pageSearchSource,
    runSearch,
    searchKeyword,
    searchLoading,
    searchResultType,
    songlistPage,
    songlistSearchResults.length,
    songlistTotal,
  ])

  const initializeFromRequest = useCallback((payload: SearchPageRequest) => {
    const nextKeyword = payload.keyword?.trim() ?? ''
    const nextSource = defaultSearchSource ?? 'all'

    searchRequestIdRef.current += 1
    searchTipRequestIdRef.current += 1
    setSearchLoading(false)
    setLoadingMore(false)
    setSearchTipLoading(false)
    setSearchTipList([])
    setSearchText(nextKeyword)
    setSearchResultType('music')
    setPageSearchSource(nextSource)
    setMusicSearchResults([])
    setSonglistSearchResults([])
    setMusicTotal(0)
    setSonglistTotal(0)
    setMusicPage(1)
    setSonglistPage(1)
    searchLoadedKeyRef.current.music = ''
    searchLoadedKeyRef.current.songlist = ''
    loadHotSearchList(nextSource)

    if (payload.submit && nextKeyword) {
      setSearchInputEditing(false)
      setSearchKeyword(nextKeyword)
      global.app_event.verticalSearchStateUpdated({
        keyword: nextKeyword,
        source: nextSource,
      })
      void addHistoryWord(nextKeyword)
      void runSearch(nextKeyword, nextSource, 'music', 1, false)
      forceDismissSearchInput()
      return
    }

    setSearchKeyword('')
    setSearchInputEditing(true)
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    if (!nextKeyword) {
      loadSearchHistoryList()
      return
    }
    requestSearchTips(nextKeyword, nextSource)
  }, [defaultSearchSource, forceDismissSearchInput, loadHotSearchList, loadSearchHistoryList, requestSearchTips, runSearch])

  useEffect(() => {
    if (!visible || !request) return
    if (requestTokenRef.current === request.token) return
    requestTokenRef.current = request.token
    initializeFromRequest(request)
  }, [initializeFromRequest, request, visible])

  useBackHandler(useCallback(() => {
    if (!visible) return false
    handleClose()
    return true
  }, [handleClose, visible]))

  const renderSearchResultItem: ListRenderItem<SearchResultItem> = useCallback(({ item, index }) => {
    const isLoved = Boolean(lovedSongMap[String(item.id)])
    return (
      <SearchMusicResultRow
        item={item}
        index={index}
        keyword={searchKeyword}
        isLoved={isLoved}
        last={index === musicSearchResults.length - 1}
        onPress={() => { void handlePlaySearchSong(item) }}
        onToggleLoved={() => { void handleToggleSearchLoved(item) }}
        onAdd={() => { handleShowMusicAddModal(item) }}
      />
    )
  }, [handlePlaySearchSong, handleShowMusicAddModal, handleToggleSearchLoved, lovedSongMap, musicSearchResults.length, searchKeyword])

  const renderSonglistResultItem: ListRenderItem<SearchSonglistItem> = useCallback(({ item, index }) => {
    return (
      <SearchSonglistResultRow
        item={item}
        keyword={searchKeyword}
        last={index === songlistSearchResults.length - 1}
        onPress={() => { handleOpenSonglistDetail(item) }}
      />
    )
  }, [handleOpenSonglistDetail, searchKeyword, songlistSearchResults.length])

  const searchAssistKeyword = searchText.trim()
  const suggestionList = searchAssistKeyword ? searchTipList : hotSearchList
  const showInitialPage = isSearchInputEditing || !searchKeyword
  const resultTitle = searchResultType === 'songlist' ? t('search_result_songlist_title') : t('search_result_music_title')
  const resultCount = searchResultType === 'songlist' ? songlistTotal : musicTotal
  const resultMeta = resultCount > 0
    ? (searchResultType === 'songlist'
        ? t('search_about_songlist', { num: resultCount })
        : t('search_about_music', { num: resultCount }))
    : undefined
  const canLoadMore = searchResultType === 'music'
    ? musicSearchResults.length > 0 && (musicTotal === 0 || musicSearchResults.length < musicTotal)
    : songlistSearchResults.length > 0 && (songlistTotal === 0 || songlistSearchResults.length < songlistTotal)

  const searchHeader = useMemo(() => {
    return (
      <View style={[styles.searchResultHeader, { paddingTop: statusBarHeight + 10 }]}>
        <View style={styles.topBar}>
          <BackButton onPress={handleClose} accessibilityLabel={t('back')} />
        </View>

        <View style={styles.searchUnderline}>
          <MdiIcon name="magnify" size={24} color={r.ink} />
          {isSearchInputEditing
            ? (
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                value={searchText}
                onChangeText={handleSearchTextChange}
                disableFullscreenUI
                blurOnSubmit
                autoFocus
                underlineColorAndroid="transparent"
                selectionColor={r.ink}
                cursorColor={r.ink}
                onBlur={handleSearchInputBlur}
                onSubmitEditing={({ nativeEvent }) => { handleSubmitSearch(nativeEvent.text ?? searchText) }}
                returnKeyType="search"
                placeholder={t('me_search_placeholder')}
                placeholderTextColor={r.quiet}
              />
              )
            : (
              <TouchableOpacity style={styles.searchInputTrigger} activeOpacity={0.85} onPress={handleBeginSearchInputEdit}>
                <Text
                  size={magType.searchInput.size}
                  color={searchText ? r.ink : r.quiet}
                  numberOfLines={1}
                  style={styles.searchInputText}
                >
                  {searchText || t('me_search_placeholder')}
                </Text>
              </TouchableOpacity>
              )}
          {searchText.length || searchKeyword.length
            ? (
              <TouchableOpacity
                style={styles.clearSearchButton}
                activeOpacity={0.7}
                onPress={handleClearSearchText}
                hitSlop={8}
              >
                <MdiIcon name="close-circle" size={20} color={r.quiet} />
              </TouchableOpacity>
              )
            : null}
        </View>

        <View style={styles.filterRow}>
          <TextTabs
            items={searchTypeTabs}
            value={searchResultType}
            onChange={handleSearchResultTypeChange}
            style={styles.searchTabs}
          />
          <View ref={sourceTriggerRef} collapsable={false}>
            <TouchableOpacity
              style={styles.sourceTrigger}
              activeOpacity={0.7}
              onPress={handleOpenSourceMenu}
            >
              <Text size={13} color={r.muted} style={styles.sourceTriggerText}>
                {t('search_source_filter', { name: sourceLabel })}
              </Text>
              <MdiIcon name="chevron-down" size={16} color={r.quiet} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }, [
    handleBeginSearchInputEdit,
    handleClearSearchText,
    handleClose,
    handleOpenSourceMenu,
    handleSearchInputBlur,
    handleSearchResultTypeChange,
    handleSearchTextChange,
    handleSubmitSearch,
    isSearchInputEditing,
    r.ink,
    r.muted,
    r.quiet,
    searchKeyword.length,
    searchResultType,
    searchText,
    searchTypeTabs,
    sourceLabel,
    statusBarHeight,
    styles,
    t,
  ])

  const panelTranslateX = useMemo(() => pageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  }), [pageAnim, width])
  const panelOpacity = useMemo(() => pageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 1],
  }), [pageAnim])

  const searchHeaderHeight = statusBarHeight + 10 + 40 + 14 + 40 + 18 + 36

  const renderSuggestionItem = useCallback((keyword: string, index: number) => {
    return (
      <TouchableOpacity
        key={`${keyword}_${index}`}
        style={styles.suggestRow}
        activeOpacity={0.7}
        onPress={() => { handlePickSearchKeyword(keyword) }}
      >
        <RankNumber rank={index + 1} width={36} />
        <Text size={magType.rowTitle.size} color={r.ink} numberOfLines={1} style={styles.suggestTitle}>{keyword}</Text>
        <MdiIcon name="arrow-top-right" size={16} color={r.quiet} />
      </TouchableOpacity>
    )
  }, [handlePickSearchKeyword, r.ink, r.quiet, styles])

  const initialView = useMemo(() => {
    return (
      <ScrollView
        style={styles.initialScroll}
        contentContainerStyle={[
          styles.initialContent,
          { paddingTop: searchHeaderHeight, paddingBottom: 22 + bottomPad },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        {!searchAssistKeyword
          ? (
            <View>
              <SectionHeader
                title={t('search_recent_title')}
                showRule={false}
                style={styles.recentHeader}
                trailing={searchHistoryList.length
                  ? (
                    <TouchableOpacity activeOpacity={0.7} onPress={handleClearSearchHistoryList} hitSlop={8}>
                      <Text size={magType.sectionMeta.size} color={r.muted} style={styles.clearHistoryText}>
                        {t('search_clear_all')}
                      </Text>
                    </TouchableOpacity>
                    )
                  : undefined}
              />
              <View style={styles.chipWrap}>
                {searchHistoryList.length
                  ? searchHistoryList.map((keyword, index) => (
                    <TouchableOpacity
                      key={`${keyword}_${index}`}
                      style={styles.historyChip}
                      activeOpacity={0.82}
                      onPress={() => { handlePickSearchKeyword(keyword) }}
                      onLongPress={() => { handleRemoveSearchHistoryItem(keyword) }}
                    >
                      <MdiIcon name="history" size={14} color={r.quiet} />
                      <Text size={13} color={r.ink} style={styles.historyChipText} numberOfLines={1}>{keyword}</Text>
                    </TouchableOpacity>
                  ))
                  : <Text size={13} color={r.faint}>{t('me_search_hint')}</Text>}
              </View>
              <Rule compact />
            </View>
            )
          : null}

        <SectionHeader
          title={t('search_suggestions_title')}
          meta={searchAssistKeyword ? undefined : t('search_hot_meta')}
          showRule={Boolean(searchAssistKeyword)}
          compactRule={Boolean(searchAssistKeyword)}
          style={searchAssistKeyword ? undefined : styles.suggestHeader}
        />

        <View style={styles.suggestList}>
          {searchTipLoading && searchAssistKeyword
            ? (
              <EmptyState
                eyebrow="LOADING"
                title={t('me_searching')}
              />
              )
            : suggestionList.length
              ? suggestionList.map((keyword, index) => renderSuggestionItem(keyword, index))
              : (
                <EmptyState
                  eyebrow="EMPTY"
                  title={searchAssistKeyword ? t('me_search_no_match') : t('me_search_hint')}
                />
                )}
        </View>
      </ScrollView>
    )
  }, [
    bottomPad,
    handleClearSearchHistoryList,
    handlePickSearchKeyword,
    handleRemoveSearchHistoryItem,
    r.faint,
    r.ink,
    r.muted,
    r.quiet,
    renderSuggestionItem,
    searchAssistKeyword,
    searchHeaderHeight,
    searchHistoryList,
    searchTipLoading,
    styles,
    suggestionList,
    t,
  ])

  const listHeader = useMemo(() => (
    <SectionHeader
      title={resultTitle}
      meta={resultMeta}
      showRule={false}
      style={styles.resultSectionHeader}
    />
  ), [resultMeta, resultTitle, styles.resultSectionHeader])

  const listFooter = useMemo(() => {
    if (!canLoadMore && !loadingMore) return null
    return (
      <TouchableOpacity
        style={styles.loadMore}
        activeOpacity={0.7}
        onPress={handleLoadMore}
        disabled={loadingMore || searchLoading}
      >
        <View style={styles.loadMoreLine} />
        <Text size={13} color={r.muted} style={styles.loadMoreText}>
          {loadingMore ? t('me_searching') : t('search_load_more')}
        </Text>
        <View style={styles.loadMoreLine} />
      </TouchableOpacity>
    )
  }, [canLoadMore, handleLoadMore, loadingMore, r.muted, searchLoading, styles, t])

  if (!shouldRender) return null

  return (
    <Animated.View
      style={[
        styles.overlayRoot,
        {
          opacity: panelOpacity,
          transform: [{ translateX: panelTranslateX }],
        },
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.searchModeRoot}>
        <View style={styles.searchResultHeaderFloating}>
          {searchHeader}
        </View>
        {showInitialPage
          ? initialView
          : searchResultType === 'songlist'
            ? (
              <FlatList
                style={styles.searchResultList}
                contentContainerStyle={[
                  styles.searchResultContent,
                  { paddingTop: searchHeaderHeight, paddingBottom: 16 + bottomPad },
                ]}
                data={songlistSearchResults}
                renderItem={renderSonglistResultItem}
                keyExtractor={(item, index) => `${item.id}_${item.source}_${index}`}
                ListHeaderComponent={listHeader}
                ListFooterComponent={listFooter}
                ListEmptyComponent={(
                  <EmptyState
                    eyebrow={searchLoading ? 'LOADING' : 'NO RESULT · 0'}
                    title={searchLoading ? t('me_searching') : t('me_search_no_match')}
                  />
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
              )
            : (
              <FlatList
                style={styles.searchResultList}
                contentContainerStyle={[
                  styles.searchResultContent,
                  { paddingTop: searchHeaderHeight, paddingBottom: 16 + bottomPad },
                ]}
                data={musicSearchResults}
                renderItem={renderSearchResultItem}
                keyExtractor={(item, index) => `${item.id}_${item.source}_${index}`}
                ListHeaderComponent={listHeader}
                ListFooterComponent={listFooter}
                ListEmptyComponent={(
                  <EmptyState
                    eyebrow={searchLoading ? 'LOADING' : 'NO RESULT · 0'}
                    title={searchLoading ? t('me_searching') : t('me_search_no_match')}
                  />
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
              )}
      </View>
      <MagMenu
        visible={sourceMenuVisible}
        onClose={() => { setSourceMenuVisible(false) }}
        items={sourceMenuItems}
        value={pageSearchSource}
        onChange={handleSelectSource}
        anchor={sourceMenuAnchor}
      />
      <MusicAddModal ref={musicAddModalRef} />
    </Animated.View>
  )
}

const useLuxStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    overlayRoot: {
      ...StyleSheet.absoluteFillObject,
      zIndex: APP_LAYER_INDEX.controls - 1,
      backgroundColor: r.paper,
    },
    searchModeRoot: {
      flex: 1,
      backgroundColor: r.paper,
    },
    searchResultHeader: {
      position: 'relative',
      overflow: 'visible',
      paddingHorizontal: PAGE_GUTTER,
      paddingBottom: 0,
    },
    searchResultHeaderFloating: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: APP_LAYER_INDEX.controls,
      elevation: 0,
      backgroundColor: r.paper,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
    },
    searchUnderline: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 14,
      borderBottomWidth: 1.5,
      borderBottomColor: r.ink,
      paddingBottom: 8,
      gap: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: magType.searchInput.size,
      fontWeight: '800',
      color: r.ink,
      paddingVertical: 0,
      includeFontPadding: false,
      margin: 0,
      backgroundColor: 'transparent',
    },
    searchInputTrigger: {
      flex: 1,
      justifyContent: 'center',
      minHeight: 30,
    },
    searchInputText: {
      fontWeight: '800',
    },
    clearSearchButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filterRow: {
      marginTop: 18,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      gap: 12,
    },
    searchTabs: {
      flexShrink: 1,
    },
    sourceTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingBottom: 10,
    },
    sourceTriggerText: {
      fontWeight: '600',
    },
    searchResultList: {
      flex: 1,
      backgroundColor: r.paper,
    },
    searchResultContent: {
      paddingHorizontal: PAGE_GUTTER,
      paddingBottom: 16,
    },
    resultSectionHeader: {
      marginTop: 18,
      marginBottom: SECTION_TO_LIST,
    },
    initialScroll: {
      flex: 1,
      backgroundColor: r.paper,
    },
    initialContent: {
      paddingHorizontal: PAGE_GUTTER,
    },
    recentHeader: {
      marginTop: 18,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: SECTION_TO_LIST,
      marginBottom: 4,
    },
    historyChip: {
      height: 30,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: r.hairline,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: '100%',
    },
    historyChipText: {
      fontWeight: '600',
      maxWidth: 220,
    },
    clearHistoryText: {
      fontWeight: '600',
    },
    suggestHeader: {
      marginTop: 4,
    },
    suggestList: {
      marginTop: SECTION_TO_LIST,
    },
    suggestRow: {
      minHeight: 52,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
    },
    suggestTitle: {
      flex: 1,
      fontWeight: '700',
      minWidth: 0,
    },
    loadMore: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 22,
    },
    loadMoreLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: r.hairline,
    },
    loadMoreText: {
      fontWeight: '600',
    },
  })
})
