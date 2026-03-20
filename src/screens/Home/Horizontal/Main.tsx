import { useEffect, useMemo, useState } from 'react'
import Mylist from '../Views/Mylist'
import Setting from '../Views/Setting'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { setNavActiveId } from '@/core/common'

const normalizeNavId = (id: CommonState['navActiveId']): 'nav_love' | 'nav_setting' => {
  return id === 'nav_setting' ? 'nav_setting' : 'nav_love'
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
      case 'nav_love': return <Mylist />
      case 'nav_setting': return <Setting />
      default: return <Mylist />
    }
  }, [id])

  return component
}


export default Main

