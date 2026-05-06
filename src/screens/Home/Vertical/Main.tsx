/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react'
import { View } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import commonState from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { setNavActiveId } from '@/core/common'
import { type NAV_ID_Type } from '@/config/constant'
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
  const [playlistSharedTopBarVisible, setPlaylistSharedTopBarVisible] = useState(true)
  const [playlistDetailVisible, setPlaylistDetailVisible] = useState(false)

  const onPageSelected = useCallback(({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    activeIndexRef.current = nativeEvent.position
    const navId = indexMap[nativeEvent.position] ?? 'nav_search'
    setActiveNavId(navId)
    if (navId !== commonState.navActiveId) setNavActiveId(navId)
  }, [])

  useEffect(() => {
    const handleNavUpdate = (id: NAV_ID_Type) => {
      if (playlistDetailVisible) global.app_event.closePlaylistDetail()
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
  }, [playlistDetailVisible])

  useEffect(() => {
    const handleOpenSearchPage = (payload: Omit<SearchPageRequest, 'token'>) => {
      if (playlistDetailVisible) global.app_event.closePlaylistDetail()
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
  }, [playlistDetailVisible])

  useEffect(() => {
    const handleOpen = () => { setPlaylistDetailVisible(true) }
    const handleClose = () => { setPlaylistDetailVisible(false) }

    global.app_event.on('openPlaylistDetail', handleOpen)
    global.app_event.on('closePlaylistDetail', handleClose)
    return () => {
      global.app_event.off('openPlaylistDetail', handleOpen)
      global.app_event.off('closePlaylistDetail', handleClose)
    }
  }, [])

  useEffect(() => {
    global.app_event.verticalSearchPageVisibleChanged(searchPageVisible)
  }, [searchPageVisible])

  useEffect(() => {
    if (activeNavId === 'nav_setting') return
    global.app_event.settingsSearchStateUpdated({ keyword: '' })
  }, [activeNavId])

  const sharedTopBarVisible = !playlistDetailVisible && !searchPageVisible && (
    activeNavId === 'nav_search' ||
    activeNavId === 'nav_setting' ||
    (activeNavId === 'nav_love' && playlistSharedTopBarVisible)
  )

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
        scrollEnabled={!searchPageVisible && !playlistDetailVisible}
        offscreenPageLimit={1}
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
