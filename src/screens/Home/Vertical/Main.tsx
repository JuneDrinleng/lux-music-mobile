import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react'
import { View } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import commonState from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { setNavActiveId } from '@/core/common'
import type { NAV_ID_Type } from '@/config/constant'
import SearchPage, { type SearchPageRequest } from './SearchPage'
import SharedTopBar from './SharedTopBar'
import HomeTab from './Tabs/HomeTab'
import PlaylistTab from './Tabs/PlaylistTab'
import SettingsTab from './Tabs/SettingsTab'

const normalizeNavId = (id: NAV_ID_Type): 'nav_search' | 'nav_love' | 'nav_setting' => {
  if (id === 'nav_setting') return 'nav_setting'
  if (id === 'nav_search') return 'nav_search'
  return 'nav_love'
}

const viewMap: Record<NAV_ID_Type, number> = {
  nav_search: 0,
  nav_songlist: 1,
  nav_top: 1,
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
  const [activeNavId, setActiveNavId] = useState<'nav_search' | 'nav_love' | 'nav_setting'>(normalizeNavId(commonState.navActiveId))
  const [searchPageVisible, setSearchPageVisible] = useState(false)
  const [searchPageRequest, setSearchPageRequest] = useState<SearchPageRequest | null>(null)
  const [playlistSharedTopBarVisible, setPlaylistSharedTopBarVisible] = useState(true)

  const onPageSelected = useCallback(({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    activeIndexRef.current = nativeEvent.position
    const navId = indexMap[nativeEvent.position] ?? 'nav_search'
    setActiveNavId(navId)
    if (navId !== commonState.navActiveId) setNavActiveId(navId)
  }, [])

  useEffect(() => {
    const normalized = normalizeNavId(commonState.navActiveId)
    if (normalized === commonState.navActiveId) return
    setNavActiveId(normalized)
  }, [])

  useEffect(() => {
    const handleNavUpdate = (id: NAV_ID_Type) => {
      const index = viewMap[id] ?? 0
      if (activeIndexRef.current === index) return
      activeIndexRef.current = index
      pagerViewRef.current?.setPage(index)
      const normalized = normalizeNavId(id)
      setActiveNavId(normalized)
      if (normalized !== id) setNavActiveId(normalized)
    }

    global.state_event.on('navActiveIdUpdated', handleNavUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavUpdate)
    }
  }, [])

  useEffect(() => {
    const handleOpenSearchPage = (payload: Omit<SearchPageRequest, 'token'>) => {
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
  }, [])

  useEffect(() => {
    global.app_event.verticalSearchPageVisibleChanged(searchPageVisible)
  }, [searchPageVisible])

  useEffect(() => {
    if (activeNavId === 'nav_setting') return
    global.app_event.settingsSearchStateUpdated({ keyword: '' })
  }, [activeNavId])

  const sharedTopBarVisible = !searchPageVisible && (
    activeNavId === 'nav_search' ||
    activeNavId === 'nav_setting' ||
    (activeNavId === 'nav_love' && playlistSharedTopBarVisible)
  )

  const component = useMemo(() => (
    <View style={styles.root}>
      <SharedTopBar
        visible={sharedTopBarVisible}
        mode={activeNavId === 'nav_setting' ? 'settings' : 'music'}
      />
      <PagerView
        ref={pagerViewRef}
        initialPage={activeIndexRef.current}
        onPageSelected={onPageSelected}
        scrollEnabled={!searchPageVisible}
        style={styles.pagerView}
      >
        <View collapsable={false} key="nav_search" style={styles.pageStyle}>
          <HomeTab />
        </View>
        <View collapsable={false} key="nav_love" style={styles.pageStyle}>
          <PlaylistTab onSharedTopBarVisibleChange={setPlaylistSharedTopBarVisible} />
        </View>
        <View collapsable={false} key="nav_setting" style={styles.pageStyle}>
          <SettingsTab />
        </View>
      </PagerView>
      <SearchPage
        visible={searchPageVisible}
        request={searchPageRequest}
        onClose={() => { setSearchPageVisible(false) }}
      />
    </View>
  ), [activeNavId, onPageSelected, searchPageRequest, searchPageVisible, sharedTopBarVisible])

  return component
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
