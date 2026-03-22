import { useCallback, useEffect, useMemo, useRef, type ComponentRef } from 'react'
import { View } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import commonState from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { setNavActiveId } from '@/core/common'
import type { NAV_ID_Type } from '@/config/constant'
import MeTab from './Tabs/MeTab'
import SettingsTab from './Tabs/SettingsTab'

const normalizeNavId = (id: NAV_ID_Type): 'nav_love' | 'nav_setting' => {
  return id === 'nav_setting' ? 'nav_setting' : 'nav_love'
}

const viewMap: Record<NAV_ID_Type, number> = {
  nav_search: 0,
  nav_songlist: 0,
  nav_top: 0,
  nav_love: 0,
  nav_setting: 1,
}

const indexMap = [
  'nav_love',
  'nav_setting',
] as const

const Main = () => {
  const pagerViewRef = useRef<ComponentRef<typeof PagerView>>(null)
  const activeIndexRef = useRef(viewMap[commonState.navActiveId] ?? 0)

  const onPageSelected = useCallback(({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    activeIndexRef.current = nativeEvent.position
    const navId = indexMap[nativeEvent.position] ?? 'nav_love'
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
      pagerViewRef.current?.setPageWithoutAnimation(index)
      const normalized = normalizeNavId(id)
      if (normalized !== id) setNavActiveId(normalized)
    }

    global.state_event.on('navActiveIdUpdated', handleNavUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleNavUpdate)
    }
  }, [])

  const component = useMemo(() => (
    <PagerView
      ref={pagerViewRef}
      initialPage={activeIndexRef.current}
      onPageSelected={onPageSelected}
      scrollEnabled
      style={styles.pagerView}
    >
      <View collapsable={false} key="nav_love" style={styles.pageStyle}>
        <MeTab />
      </View>
      <View collapsable={false} key="nav_setting" style={styles.pageStyle}>
        <SettingsTab />
      </View>
    </PagerView>
  ), [onPageSelected])

  return component
}

const styles = createStyle({
  pagerView: {
    flex: 1,
  },
  pageStyle: {
    flex: 1,
  },
})

export default Main
