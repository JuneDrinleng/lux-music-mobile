import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  FlatList,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  useWindowDimensions,
  type ListRenderItem,
} from 'react-native'
import { BlurView } from '@react-native-community/blur'
import { Search, X } from 'lucide-react-native'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import Image from '@/components/common/Image'
import MusicAddModal, { type MusicAddModalType } from '@/components/MusicAddModal'
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import { addListMusics, getListMusics, removeListMusics } from '@/core/list'
import { addMusicToQueueAndPlay } from '@/core/player/player'
import { search as searchOnlineMusic } from '@/core/search/music'
import { addHistoryWord, clearHistoryList, getSearchHistory, removeHistoryWord } from '@/core/search/search'
import { APP_LAYER_INDEX, LIST_IDS } from '@/config/constant'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { type Source as OnlineSearchSource } from '@/store/search/music/state'
import settingState from '@/store/setting/state'
import { type VerticalSearchPagePayload, type VerticalSearchSource } from '@/event/appEvent'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { createStyle } from '@/utils/tools'
import { debounce } from '@/utils'
import musicSdk from '@/utils/musicSdk'

const BOTTOM_DOCK_BASE_HEIGHT = 112
const sourceTagColorMap: Record<string, { text: string, background: string }> = {
  tx: { text: '#31c27c', background: '#ecfdf3' },
  wy: { text: '#d81e06', background: '#fef2f2' },
  kg: { text: '#2f88ff', background: '#eff6ff' },
  kw: { text: '#f59e0b', background: '#fffbeb' },
  mg: { text: '#e11d8d', background: '#fdf2f8' },
}
const hasNativeBlurView = Boolean(UIManager.getViewManagerConfig?.(Platform.OS === 'ios' ? 'BlurView' : 'AndroidBlurView'))

type SearchResultItem = LX.Music.MusicInfoOnline
export interface SearchPageRequest extends VerticalSearchPagePayload {
  token: number
}

const getSourceTagColor = (source: string) => {
  return sourceTagColorMap[source.toLowerCase()] ?? { text: '#111827', background: '#e5e7eb' }
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
  const t = useI18n()
  const { width } = useWindowDimensions()
  const statusBarHeight = useStatusbarHeight()
  const searchSource = useSettingValue('search.defaultSource')
  const shouldUseSearchBlur = hasNativeBlurView
  const [searchText, setSearchText] = useState('')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([])
  const [lovedSongMap, setLovedSongMap] = useState<Record<string, true>>({})
  const [isSearchInputEditing, setSearchInputEditing] = useState(false)
  const [searchHistoryList, setSearchHistoryList] = useState<string[]>([])
  const [searchTipList, setSearchTipList] = useState<string[]>([])
  const [searchTipLoading, setSearchTipLoading] = useState(false)
  const [shouldRender, setShouldRender] = useState(visible)
  const searchRequestIdRef = useRef(0)
  const searchTipRequestIdRef = useRef(0)
  const searchInputRef = useRef<TextInput>(null)
  const musicAddModalRef = useRef<MusicAddModalType>(null)
  const requestTokenRef = useRef<number | null>(null)
  const pageAnim = useRef(new Animated.Value(visible ? 1 : 0)).current

  const forceDismissSearchInput = useCallback(() => {
    searchInputRef.current?.blur()
    Keyboard.dismiss()
  }, [])
  const resetSearchPageState = useCallback(() => {
    searchRequestIdRef.current += 1
    searchTipRequestIdRef.current += 1
    setSearchLoading(false)
    setSearchTipLoading(false)
    setSearchTipList([])
    setSearchText('')
    setSearchKeyword('')
    setSearchResults([])
    setSearchInputEditing(false)
    global.app_event.verticalSearchStateUpdated({
      keyword: '',
      source: searchSource ?? 'all',
    })
    forceDismissSearchInput()
  }, [forceDismissSearchInput, searchSource])

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
      setShouldRender(true)
      Animated.timing(pageAnim, {
        toValue: 1,
        duration: 268,
        easing: Easing.bezier(0.22, 0.84, 0.22, 1),
        useNativeDriver: true,
      }).start()
      return
    }

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
  const requestSearchTips = useMemo(() => debounce((keyword: string, source: VerticalSearchSource) => {
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
  const runSearch = useCallback(async(keyword: string, source: VerticalSearchSource) => {
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
    requestSearchTips(keyword, searchSource)
  }, [isSearchInputEditing, loadSearchHistoryList, requestSearchTips, searchSource])
  const handleSearchInputBlur = useCallback(() => {
    requestAnimationFrame(() => {
      setSearchInputEditing(false)
    })
  }, [])
  const handleClearSearchText = useCallback(() => {
    searchRequestIdRef.current += 1
    searchTipRequestIdRef.current += 1
    setSearchLoading(false)
    setSearchTipLoading(false)
    setSearchTipList([])
    setSearchText('')
    setSearchKeyword('')
    setSearchResults([])
    setSearchInputEditing(true)
    global.app_event.verticalSearchStateUpdated({
      keyword: '',
      source: searchSource ?? 'all',
    })
    loadSearchHistoryList()
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
  }, [loadSearchHistoryList, searchSource])
  const handleSubmitSearch = useCallback((text: string) => {
    forceDismissSearchInput()
    const input = (text || searchText).trim()
    setSearchText(text || searchText)
    setSearchInputEditing(false)
    searchTipRequestIdRef.current += 1
    setSearchTipLoading(false)
    setSearchTipList([])

    if (!input) {
      setSearchKeyword('')
      setSearchResults([])
      requestAnimationFrame(() => {
        setSearchInputEditing(true)
        loadSearchHistoryList()
        searchInputRef.current?.focus()
      })
      return
    }

    setSearchKeyword(input)
    setSearchResults([])
    global.app_event.verticalSearchStateUpdated({
      keyword: input,
      source: searchSource ?? 'all',
    })
    void addHistoryWord(input)
    void runSearch(input, searchSource ?? 'all')
    forceDismissSearchInput()
  }, [forceDismissSearchInput, loadSearchHistoryList, runSearch, searchSource, searchText])
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
    requestSearchTips(keyword, searchSource ?? 'all')
  }, [loadSearchHistoryList, requestSearchTips, searchSource, searchText])
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

  const initializeFromRequest = useCallback((payload: SearchPageRequest) => {
    const nextKeyword = payload.keyword?.trim() ?? ''

    searchRequestIdRef.current += 1
    searchTipRequestIdRef.current += 1
    setSearchLoading(false)
    setSearchTipLoading(false)
    setSearchTipList([])
    setSearchText(nextKeyword)

    if (payload.submit && nextKeyword) {
      setSearchInputEditing(false)
      setSearchKeyword(nextKeyword)
      setSearchResults([])
      global.app_event.verticalSearchStateUpdated({
        keyword: nextKeyword,
        source: searchSource ?? 'all',
      })
      void addHistoryWord(nextKeyword)
      void runSearch(nextKeyword, searchSource ?? 'all')
      forceDismissSearchInput()
      return
    }

    setSearchKeyword('')
    setSearchResults([])
    setSearchInputEditing(true)
    requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })
    if (!nextKeyword) {
      loadSearchHistoryList()
      return
    }
    requestSearchTips(nextKeyword, searchSource ?? 'all')
  }, [forceDismissSearchInput, loadSearchHistoryList, requestSearchTips, runSearch, searchSource])

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

  const renderSearchResultItem: ListRenderItem<SearchResultItem> = useCallback(({ item }) => {
    const isLoved = Boolean(lovedSongMap[String(item.id)])
    const sourceTagColor = getSourceTagColor(item.source)
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
              <Text size={10} color={sourceTagColor.text} style={[styles.songSource, { backgroundColor: sourceTagColor.background }]}>{item.source.toUpperCase()}</Text>
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

  const searchAssistKeyword = searchText.trim()
  const searchAssistList = useMemo(() => {
    return searchAssistKeyword ? searchTipList : searchHistoryList
  }, [searchAssistKeyword, searchHistoryList, searchTipList])
  const showInitialPage = isSearchInputEditing || !searchKeyword

  const searchHeader = useMemo(() => {
    return (
      <View style={[styles.searchResultHeader, { paddingTop: statusBarHeight + 18 }]}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backButton} activeOpacity={0.82} onPress={handleClose}>
            <View style={styles.backBubble}>
              <View style={styles.backInner}>
                <Icon name="chevron-left" rawSize={20} color="#232733" />
              </View>
            </View>
          </TouchableOpacity>
          <View style={styles.searchDock}>
            <View style={styles.searchField}>
              {shouldUseSearchBlur
                ? <>
                    <BlurView
                      style={StyleSheet.absoluteFillObject}
                      blurType={Platform.OS === 'ios' ? 'chromeMaterialLight' : 'light'}
                      blurAmount={Platform.OS === 'ios' ? 34 : 24}
                      blurRadius={Platform.OS === 'android' ? 24 : undefined}
                      downsampleFactor={Platform.OS === 'android' ? 6 : undefined}
                      overlayColor={Platform.OS === 'android' ? 'rgba(255,255,255,0.16)' : 'transparent'}
                      reducedTransparencyFallbackColor="rgba(255,255,255,0.72)"
                    />
                    <View style={styles.searchGlassTint} pointerEvents="none" />
                  </>
                : <View style={styles.searchGlassFallback} pointerEvents="none" />}
              <View style={styles.searchGlassRim} pointerEvents="none" />
              <View style={styles.searchContent}>
                <Search size={17} color="#666d7b" strokeWidth={2.1} />
                {isSearchInputEditing
                  ? <View style={styles.searchInputSlot}>
                      <TextInput
                        ref={searchInputRef}
                        style={styles.searchInput}
                        value={searchText}
                        onChangeText={handleSearchTextChange}
                        disableFullscreenUI
                        blurOnSubmit
                        autoFocus
                        underlineColorAndroid="transparent"
                        selectionColor="#666d7b"
                        onBlur={handleSearchInputBlur}
                        onSubmitEditing={({ nativeEvent }) => { handleSubmitSearch(nativeEvent.text ?? searchText) }}
                        returnKeyType="search"
                        placeholder={t('me_search_placeholder')}
                        placeholderTextColor="#9aa1ae"
                      />
                    </View>
                  : <TouchableOpacity style={styles.searchInputTrigger} activeOpacity={0.85} onPress={handleBeginSearchInputEdit}>
                      <Text size={13} color={searchText ? '#232733' : '#9aa1ae'} numberOfLines={1} style={styles.searchInputText}>
                        {searchText || t('me_search_placeholder')}
                      </Text>
                    </TouchableOpacity>}
                <TouchableOpacity
                  style={styles.clearSearchButton}
                  activeOpacity={0.8}
                  onPress={handleClearSearchText}
                  disabled={!searchText.length && !searchKeyword.length}
                >
                  <X
                    size={16}
                    color={searchText.length || searchKeyword.length ? '#666d7b' : '#bcc2cf'}
                    strokeWidth={2.2}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    )
  }, [handleBeginSearchInputEdit, handleClearSearchText, handleClose, handleSearchInputBlur, handleSearchTextChange, handleSubmitSearch, isSearchInputEditing, searchKeyword.length, searchText, shouldUseSearchBlur, statusBarHeight, t])

  const panelTranslateX = useMemo(() => pageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [width, 0],
  }), [pageAnim, width])
  const panelOpacity = useMemo(() => pageAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.86, 1],
  }), [pageAnim])
  const searchHeaderHeight = statusBarHeight + 18 + 44 + 16
  const renderInitialItem = useCallback((keyword: string, index: number) => {
    const isSuggestion = Boolean(searchAssistKeyword)
    return (
      <TouchableOpacity
        key={`${keyword}_${index}`}
        style={[
          styles.initialRow,
          index < searchAssistList.length - 1 ? styles.initialRowSpacing : null,
        ]}
        activeOpacity={0.82}
        onPress={() => { handlePickSearchKeyword(keyword) }}
        onLongPress={!isSuggestion ? () => { handleRemoveSearchHistoryItem(keyword) } : undefined}
      >
        <View style={styles.initialRowIcon}>
          {isSuggestion
            ? <Icon name="search-2" rawSize={15} color="#757b85" />
            : <MaterialCommunityIcon name="history" size={16} color="#757b85" />}
        </View>
        <View style={styles.initialRowBody}>
          <Text size={14} color="#1a1c1e" numberOfLines={1} style={styles.initialRowTitle}>{keyword}</Text>
        </View>
        {isSuggestion
          ? <MaterialCommunityIcon
              name="arrow-top-left"
              size={16}
              color="#8a909c"
            />
          : <TouchableOpacity
              style={styles.initialRowDismiss}
              activeOpacity={0.72}
              onPress={() => { handleRemoveSearchHistoryItem(keyword) }}
            >
              <MaterialCommunityIcon name="close" size={16} color="#8a909c" />
            </TouchableOpacity>}
      </TouchableOpacity>
    )
  }, [handlePickSearchKeyword, handleRemoveSearchHistoryItem, searchAssistKeyword, searchAssistList.length])
  const initialView = useMemo(() => {
    const sectionTitle = searchAssistKeyword ? t('search_suggestions_title') : t('search_recent_title')
    return (
      <ScrollView
        style={styles.initialScroll}
        contentContainerStyle={[
          styles.initialContent,
          { paddingTop: searchHeaderHeight, paddingBottom: 22 + BOTTOM_DOCK_BASE_HEIGHT },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View style={styles.initialSectionHeader}>
          <Text size={22} color="#1a1c1e" style={styles.initialSectionTitle}>
            {sectionTitle}
          </Text>
          {!searchAssistKeyword && searchHistoryList.length
            ? <TouchableOpacity
                style={styles.initialSectionAction}
                activeOpacity={0.82}
                onPress={handleClearSearchHistoryList}
              >
                <Text size={12} color="#58651b" style={styles.initialSectionActionText}>{t('search_clear_all')}</Text>
              </TouchableOpacity>
            : null}
        </View>

        <View style={styles.initialList}>
          {searchTipLoading && searchAssistKeyword
            ? <View style={styles.initialEmpty}>
                <Text size={13} color="#8a92a1">{t('me_searching')}</Text>
              </View>
            : searchAssistList.length
              ? searchAssistList.map((keyword, index) => renderInitialItem(keyword, index))
              : <View style={styles.initialEmpty}>
                  <Text size={13} color="#8a92a1">
                    {searchAssistKeyword ? t('me_search_no_match') : t('me_search_hint')}
                  </Text>
                </View>}
        </View>
      </ScrollView>
    )
  }, [searchHeaderHeight, searchAssistKeyword, t, searchHistoryList.length, searchTipLoading, searchAssistList, handleClearSearchHistoryList, renderInitialItem])

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
          : <FlatList
              style={styles.searchResultList}
              contentContainerStyle={[
                styles.searchResultContent,
                { paddingTop: searchHeaderHeight, paddingBottom: 16 + BOTTOM_DOCK_BASE_HEIGHT },
              ]}
              data={searchResults}
              renderItem={renderSearchResultItem}
              keyExtractor={(item, index) => `${item.id}_${item.source}_${index}`}
              ListEmptyComponent={(
                <View style={styles.searchResultStatus}>
                  <Text size={16} color="#6b7280" style={styles.searchResultStatusText}>
                    {searchLoading ? t('me_searching') : t('me_search_no_match')}
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
            />}
      </View>
      <MusicAddModal ref={musicAddModalRef} />
    </Animated.View>
  )
}

const styles = createStyle({
  overlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: APP_LAYER_INDEX.controls - 1,
    elevation: APP_LAYER_INDEX.controls - 1,
    backgroundColor: '#eef0fb',
  },
  searchModeRoot: {
    flex: 1,
    backgroundColor: '#eef0fb',
  },
  searchResultHeader: {
    position: 'relative',
    overflow: 'visible',
    paddingHorizontal: 18,
  },
  searchResultHeaderFloating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: APP_LAYER_INDEX.controls,
    elevation: 0,
    backgroundColor: '#eef0fb',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchResultList: {
    flex: 1,
    backgroundColor: '#eef0fb',
  },
  searchResultContent: {
    paddingHorizontal: 18,
    paddingBottom: 16,
  },
  initialScroll: {
    flex: 1,
    backgroundColor: '#eef0fb',
  },
  initialContent: {
    paddingHorizontal: 18,
  },
  initialSectionHeader: {
    minHeight: 32,
    marginTop: 16,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  initialSectionTitle: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  initialSectionAction: {
    minHeight: 28,
    paddingHorizontal: 2,
    justifyContent: 'center',
  },
  initialSectionActionText: {
    fontWeight: '700',
  },
  initialList: {
    paddingBottom: 6,
  },
  initialRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  initialRowSpacing: {
    marginBottom: 10,
  },
  initialRowIcon: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  initialRowBody: {
    flex: 1,
    marginRight: 10,
  },
  initialRowTitle: {
    fontWeight: '700',
  },
  initialRowDismiss: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialEmpty: {
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  searchAssistPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: APP_LAYER_INDEX.controls - 1,
    elevation: 0,
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchAssistTitleRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchAssistClearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchAssistContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingBottom: 8,
  },
  searchAssistChip: {
    maxWidth: '100%',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 11,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  searchAssistChipText: {
    maxWidth: 280,
  },
  searchAssistEmpty: {
    minHeight: 96,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    borderRadius: 22,
  },
  backBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    padding: 2,
    shadowColor: '#2d3242',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  backInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#f3eef2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchDock: {
    flex: 1,
    marginLeft: 12,
    position: 'relative',
    zIndex: 8,
  },
  searchField: {
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(244,247,252,0.58)',
    backgroundColor: 'rgba(255,255,255,0.28)',
    shadowColor: '#2d3242',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  searchGlassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  searchGlassFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  searchGlassRim: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  searchContent: {
    flex: 1,
    paddingLeft: 14,
    paddingRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: {
    height: '100%',
    paddingHorizontal: 0,
    margin: 0,
    backgroundColor: 'transparent',
    color: '#232733',
    fontSize: 14,
    lineHeight: 18,
    paddingVertical: 0,
    includeFontPadding: false,
  },
  searchInputSlot: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    justifyContent: 'center',
  },
  searchInputTrigger: {
    flex: 1,
    height: '100%',
    marginLeft: 10,
    justifyContent: 'center',
  },
  searchInputText: {
    lineHeight: 18,
  },
  clearSearchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  songItem: {
    minHeight: 70,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    marginBottom: 1,
  },
  songMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  songPic: {
    width: 58,
    height: 58,
    borderRadius: 16,
    shadowColor: '#747b8f',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  songInfo: {
    flex: 1,
    marginLeft: 13,
    marginRight: 12,
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
    backgroundColor: '#e5e7eb',
    marginRight: 6,
    fontWeight: '600',
  },
  listTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  searchSongActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 0,
  },
  searchSongInterval: {
    marginRight: 6,
    minWidth: 42,
    textAlign: 'right',
  },
  songActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.52)',
    borderWidth: 1,
    borderColor: 'rgba(230,234,243,0.92)',
  },
  searchLoveFilled: {
    lineHeight: 18,
    fontWeight: '700',
  },
  searchAddText: {
    lineHeight: 19,
    fontWeight: '700',
  },
  searchResultStatus: {
    width: '100%',
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    marginTop: 4,
  },
  searchResultStatusText: {
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#eadfe4',
    backgroundColor: '#fcfbfc',
    shadowColor: '#2b1f25',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 104,
    marginTop: 4,
  },
})
