/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { View } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import commonState from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { setNavActiveId } from '@/core/common'
import { type NAV_ID_Type } from '@/config/constant'
import { DailyRecommendationPage } from '@/components/recommend/DailyRecommendationPage'
import AudioEffectsPage from '@/screens/AudioEffects'
import SearchPage, { type SearchPageRequest } from './SearchPage'
import SharedTopBar from './SharedTopBar'
import HomeTab from './Tabs/HomeTab'
import PlaylistTab from './Tabs/PlaylistTab'
import SettingsTab from './Tabs/SettingsTab'

const viewMap: Record<NAV_ID_Type, number> = {
  nav_search: 0,
  nav_love: 1,
  nav_setting: 2,
}

const indexMap = [
  'nav_search',
  'nav_love',
  'nav_setting',
] as const

const Main = () => {
  const pagerViewRef = useRef<ComponentRef<typeof PagerView>>(null)
  const activeIndexRef = useRef(viewMap[commonState.navActiveId] ?? 0)
  const searchRequestTokenRef = useRef(0)
  const [activeNavId, setActiveNavId] = useState<NAV_ID_Type>(commonState.navActiveId)
  const [searchPageVisible, setSearchPageVisible] = useState(false)
  const [searchPageRequest, setSearchPageRequest] = useState<SearchPageRequest | null>(null)
  const [playlistDetailVisible, setPlaylistDetailVisible] = useState(false)
  const [localSongsVisible, setLocalSongsVisible] = useState(false)
  const [listeningStatsVisible, setListeningStatsVisible] = useState(false)
  const [listenTogetherVisible, setListenTogetherVisible] = useState(false)
  const [dailyRecommendationsVisible, setDailyRecommendationsVisible] = useState(false)
  const [audioEffectsVisible, setAudioEffectsVisible] = useState(false)
  const detailCovering = audioEffectsVisible || dailyRecommendationsVisible || playlistDetailVisible || localSongsVisible || listeningStatsVisible || listenTogetherVisible

  const onPageSelected = useCallback(({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    activeIndexRef.current = nativeEvent.position
    const navId = indexMap[nativeEvent.position] ?? 'nav_search'
    setActiveNavId(navId)
    if (navId !== commonState.navActiveId) setNavActiveId(navId)
  }, [])

  useEffect(() => {
    const handleNavUpdate = (id: NAV_ID_Type) => {
      setAudioEffectsVisible(false)
      setDailyRecommendationsVisible(false)
      if (playlistDetailVisible) global.app_event.closePlaylistDetail()
      if (localSongsVisible) global.app_event.closeLocalSongs()
      if (listeningStatsVisible) global.app_event.closeListeningStats()
      if (listenTogetherVisible) global.app_event.closeListenTogether()
      const index = viewMap[id] ?? 0
      if (activeIndexRef.current === index) return
      activeIndexRef.current = index
      pagerViewRef.current?.setPage(index)
      setActiveNavId(id)
    }

    global.state_event.on('navActiveIdUpdated', handleNavUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavUpdate)
    }
  }, [listenTogetherVisible, listeningStatsVisible, localSongsVisible, playlistDetailVisible])

  useEffect(() => {
    const handleOpenSearchPage = (payload: Omit<SearchPageRequest, 'token'>) => {
      setAudioEffectsVisible(false)
      setDailyRecommendationsVisible(false)
      if (playlistDetailVisible) global.app_event.closePlaylistDetail()
      if (localSongsVisible) global.app_event.closeLocalSongs()
      if (listeningStatsVisible) global.app_event.closeListeningStats()
      if (listenTogetherVisible) global.app_event.closeListenTogether()
      searchRequestTokenRef.current += 1
      setSearchPageRequest({
        token: searchRequestTokenRef.current,
        ...payload,
      })
      setSearchPageVisible(true)
    }
    const handleCloseSearchPage = () => {
      setSearchPageVisible(false)
    }

    global.app_event.on('openVerticalSearchPage', handleOpenSearchPage)
    global.app_event.on('closeVerticalSearchPage', handleCloseSearchPage)
    return () => {
      global.app_event.off('openVerticalSearchPage', handleOpenSearchPage)
      global.app_event.off('closeVerticalSearchPage', handleCloseSearchPage)
    }
  }, [listenTogetherVisible, listeningStatsVisible, localSongsVisible, playlistDetailVisible])

  useEffect(() => {
    const handleOpen = () => {
      setAudioEffectsVisible(false)
      setDailyRecommendationsVisible(false)
      setPlaylistDetailVisible(true)
      setLocalSongsVisible(false)
      setListeningStatsVisible(false)
    }
    const handleClose = () => { setPlaylistDetailVisible(false) }

    const handleOpenLocalSongs = () => {
      setAudioEffectsVisible(false)
      setDailyRecommendationsVisible(false)
      setLocalSongsVisible(true)
      setPlaylistDetailVisible(false)
      setListeningStatsVisible(false)
    }
    const handleCloseLocalSongs = () => { setLocalSongsVisible(false) }
    const handleOpenListeningStats = () => {
      setAudioEffectsVisible(false)
      setDailyRecommendationsVisible(false)
      setListeningStatsVisible(true)
      setPlaylistDetailVisible(false)
      setLocalSongsVisible(false)
      setListenTogetherVisible(false)
    }
    const handleCloseListeningStats = () => { setListeningStatsVisible(false) }
    const handleOpenListenTogether = () => {
      setAudioEffectsVisible(false)
      setDailyRecommendationsVisible(false)
      setListenTogetherVisible(true)
      setPlaylistDetailVisible(false)
      setLocalSongsVisible(false)
      setListeningStatsVisible(false)
    }
    const handleCloseListenTogether = () => { setListenTogetherVisible(false) }
    const handleOpenDaily = () => {
      setAudioEffectsVisible(false)
      global.app_event.closePlaylistDetail()
      global.app_event.closeLocalSongs()
      global.app_event.closeListeningStats()
      global.app_event.closeListenTogether()
      setSearchPageVisible(false)
      setDailyRecommendationsVisible(true)
    }
    const handleCloseDaily = () => { setDailyRecommendationsVisible(false) }
    const handleOpenAudio = () => {
      global.app_event.closePlaylistDetail()
      global.app_event.closeLocalSongs()
      global.app_event.closeListeningStats()
      global.app_event.closeListenTogether()
      setSearchPageVisible(false)
      setDailyRecommendationsVisible(false)
      setAudioEffectsVisible(true)
    }
    const handleCloseAudio = () => { setAudioEffectsVisible(false) }
    global.app_event.on('openAudioEffects', handleOpenAudio)
    global.app_event.on('closeAudioEffects', handleCloseAudio)
    global.app_event.on('openDailyRecommendations', handleOpenDaily)
    global.app_event.on('closeDailyRecommendations', handleCloseDaily)
    global.app_event.on('openPlaylistDetail', handleOpen)
    global.app_event.on('closePlaylistDetail', handleClose)
    global.app_event.on('openLocalSongs', handleOpenLocalSongs)
    global.app_event.on('closeLocalSongs', handleCloseLocalSongs)
    global.app_event.on('openListeningStats', handleOpenListeningStats)
    global.app_event.on('closeListeningStats', handleCloseListeningStats)
    global.app_event.on('openListenTogether', handleOpenListenTogether)
    global.app_event.on('closeListenTogether', handleCloseListenTogether)
    return () => {
      global.app_event.off('openAudioEffects', handleOpenAudio)
      global.app_event.off('closeAudioEffects', handleCloseAudio)
      global.app_event.off('openDailyRecommendations', handleOpenDaily)
      global.app_event.off('closeDailyRecommendations', handleCloseDaily)
      global.app_event.off('openPlaylistDetail', handleOpen)
      global.app_event.off('closePlaylistDetail', handleClose)
      global.app_event.off('openLocalSongs', handleOpenLocalSongs)
      global.app_event.off('closeLocalSongs', handleCloseLocalSongs)
      global.app_event.off('openListeningStats', handleOpenListeningStats)
      global.app_event.off('closeListeningStats', handleCloseListeningStats)
      global.app_event.off('openListenTogether', handleOpenListenTogether)
      global.app_event.off('closeListenTogether', handleCloseListenTogether)
    }
  }, [])

  useEffect(() => {
    global.app_event.verticalSearchPageVisibleChanged(searchPageVisible)
  }, [searchPageVisible])

  useEffect(() => {
    if (activeNavId === 'nav_setting') return
    global.app_event.settingsSearchStateUpdated({ keyword: '' })
  }, [activeNavId])

  // Home, Library, and Settings own MagTopBar (scrolls with content). Legacy
  // SharedTopBar settings search is retired; hide whenever overlays cover the pager.
  const sharedTopBarVisible = false

  const handleCloseSearchPage = useCallback(() => {
    setSearchPageVisible(false)
  }, [])

  return (
    <View style={styles.root}>
      <SharedTopBar
        visible={sharedTopBarVisible}
        mode={activeNavId === 'nav_setting' ? 'settings' : 'music'}
        hideAvatar={activeNavId !== 'nav_search'}
      />
      <PagerView
        ref={pagerViewRef}
        initialPage={activeIndexRef.current}
        onPageSelected={onPageSelected}
        scrollEnabled={!searchPageVisible && !detailCovering}
        offscreenPageLimit={1}
        style={styles.pagerView}
      >
        <View collapsable={false} key="nav_search" style={styles.pageStyle}>
          <HomeTab />
        </View>
        <View collapsable={false} key="nav_love" style={styles.pageStyle}>
          <PlaylistTab />
        </View>
        <View collapsable={false} key="nav_setting" style={styles.pageStyle}>
          <SettingsTab />
        </View>
      </PagerView>
      {audioEffectsVisible ? <AudioEffectsPage onBack={() => { global.app_event.closeAudioEffects() }} /> : null}
      {dailyRecommendationsVisible ? <DailyRecommendationPage onClose={() => { global.app_event.closeDailyRecommendations() }} /> : null}
      <SearchPage
        visible={searchPageVisible}
        covered={detailCovering}
        request={searchPageRequest}
        onClose={handleCloseSearchPage}
      />
    </View>
  )
}

const styles = createStyle({
  root: {
    flex: 1,
  },
  pagerView: {
    flex: 1,
  },
  pageStyle: {
    flex: 1,
  },
})

export default Main
