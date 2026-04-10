import { useEffect, useMemo, useState } from 'react'
import HomeTab from '../Vertical/Tabs/HomeTab'
import PlaylistTab from '../Vertical/Tabs/PlaylistTab'
import SettingsTab from '../Vertical/Tabs/SettingsTab'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { setNavActiveId } from '@/core/common'

const normalizeNavId = (id: CommonState['navActiveId']): 'nav_search' | 'nav_love' | 'nav_setting' => {
  if (id === 'nav_setting') return 'nav_setting'
  if (id === 'nav_search') return 'nav_search'
  return 'nav_love'
}

const Main = () => {
  const [id, setId] = useState<CommonState['navActiveId']>(normalizeNavId(commonState.navActiveId))

  useEffect(() => {
    const normalized = normalizeNavId(commonState.navActiveId)
    if (normalized === commonState.navActiveId) return
    setNavActiveId(normalized)
  }, [])

  useEffect(() => {
    const handleUpdate = (id: CommonState['navActiveId']) => {
      const normalized = normalizeNavId(id)
      requestAnimationFrame(() => {
        setId(normalized)
      })
      if (normalized !== id) setNavActiveId(normalized)
    }
    global.state_event.on('navActiveIdUpdated', handleUpdate)
    return () => {
      global.state_event.off('navActiveIdUpdated', handleUpdate)
    }
  }, [])

  const component = useMemo(() => {
    switch (id) {
      case 'nav_search': return <HomeTab />
      case 'nav_love': return <PlaylistTab />
      case 'nav_setting': return <SettingsTab />
      default: return <HomeTab />
    }
  }, [id])

  return component
}


export default Main

