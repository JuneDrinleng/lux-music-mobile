/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
// import { View, StyleSheet } from 'react-native'
import { useHorizontalMode } from '@/utils/hooks'
import { useBackHandler } from '@/utils/hooks/useBackHandler'

import Vertical from './Vertical'
import Horizontal from './Horizontal'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { pop } from '@/navigation'
import { Navigation } from 'react-native-navigation'
import { registerPageClose } from '@/navigation/pageTransitionRegistry'
import commonState from '@/store/common/state'
import { useComponentIds } from '@/store/common/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import PlayQueueSheet from '@/screens/Home/Vertical/PlayQueueSheet'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { PlayDetailContext } from './context'

export default ({ componentId, onClose, visible = true }: { componentId: string, onClose?: () => void, visible?: boolean }) => {
  const [nativeActive, setNativeActive] = useState(true)
  const nativeActiveRef = useRef(true)
  // Native stack player has no JS transition. Coalesce all pop callers until completion.
  useLayoutEffect(() => {
    if (onClose) return
    let pending: Promise<unknown> | undefined
    const unregister = registerPageClose(componentId, async() => {
      pending ??= Navigation.pop(componentId).finally(() => { pending = undefined })
      return pending
    })
    const appear = Navigation.events().registerComponentDidAppearListener(event => {
      if (event.componentId !== componentId) return
      nativeActiveRef.current = true
      setNativeActive(true)
    })
    const disappear = Navigation.events().registerComponentDidDisappearListener(event => {
      if (event.componentId !== componentId) return
      nativeActiveRef.current = false
      setNativeActive(false)
    })
    return () => { unregister(); appear.remove(); disappear.remove() }
  }, [componentId, onClose])

  const isHorizontalMode = useHorizontalMode()
  const componentIds = useComponentIds()
  const bottomInset = useSystemGestureInsetBottom()
  const musicInfo = usePlayerMusicInfo()

  const pic = useMemo(() => {
    const rawPic = musicInfo.pic
    if (!rawPic) return null
    return rawPic.startsWith('/') ? `file://${rawPic}` : rawPic
  }, [musicInfo.pic])

  const closePlayDetail = useCallback(() => {
    if (onClose) {
      onClose()
    } else {
      void pop(componentId)
    }
  }, [componentId, onClose])

  useBackHandler(useCallback(() => {
    if (!visible || !nativeActiveRef.current || commonState.componentIds.playDetail !== componentId) return false
    closePlayDetail()
    return true
  }, [componentId, closePlayDetail, visible]))

  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const contextValue = useMemo(() => closePlayDetail, [closePlayDetail])

  return (
      <PlayDetailContext.Provider value={contextValue}>
        <PageContent pic={pic}>
          <StatusBar />
          {
            isHorizontalMode
              ? <Horizontal componentId={componentId} />
              : <Vertical componentId={componentId} active={visible} backActive={nativeActive} />
          }
          <PlayQueueSheet
            systemGestureInsetBottom={bottomInset}
            enabled={componentIds.playDetail === componentId}
          />
        </PageContent>
      </PlayDetailContext.Provider>
  )
}
