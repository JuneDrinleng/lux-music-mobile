/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'
import AudioEffectsPage from '@/screens/AudioEffects'
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
  const [audioEffectsVisible, setAudioEffectsVisible] = useState(false)
  useEffect(() => {
    const open = () => { setAudioEffectsVisible(true) }
    const close = () => { setAudioEffectsVisible(false) }
    global.app_event.on('openAudioEffects', open)
    global.app_event.on('closeAudioEffects', close)
    return () => {
      global.app_event.off('openAudioEffects', open)
      global.app_event.off('closeAudioEffects', close)
    }
  }, [])
  const [id, setId] = useState<CommonState['navActiveId']>(normalizeNavId(commonState.navActiveId))

  useEffect(() => {
    const normalized = normalizeNavId(commonState.navActiveId)
    if (normalized === commonState.navActiveId) return
    setNavActiveId(normalized)
  }, [])

  useEffect(() => {
    const handleUpdate = (id: CommonState['navActiveId']) => {
      setAudioEffectsVisible(false)
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
      case 'nav_setting': return <SettingsTab bottomDockHeight={0} />
      default: return <HomeTab />
    }
  }, [id])

  return <View style={{ flex: 1 }}>
    {component}
    {audioEffectsVisible ? <AudioEffectsPage bottomInset={0} onBack={() => { global.app_event.closeAudioEffects() }} /> : null}
  </View>
}


export default Main

