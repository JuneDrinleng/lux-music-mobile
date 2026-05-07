/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect, useMemo } from 'react'
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
import commonState from '@/store/common/state'
import { useComponentIds } from '@/store/common/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import PlayQueueSheet from '@/screens/Home/Vertical/PlayQueueSheet'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { PlayDetailContext } from './context'

export default ({ componentId, onClose }: { componentId: string, onClose?: () => void }) => {
  const isHorizontalMode = useHorizontalMode()
  const componentIds = useComponentIds()
  const bottomInset = useSystemGestureInsetBottom()
  const musicInfo = usePlayerMusicInfo()
  const isOverlay = Boolean(onClose)

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
    if (commonState.componentIds.playDetail !== componentId) return false
    closePlayDetail()
    return true
  }, [componentId, closePlayDetail]))

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
              : <Vertical componentId={componentId} />
          }
          <PlayQueueSheet
            systemGestureInsetBottom={bottomInset}
            enabled={componentIds.playDetail === componentId}
          />
        </PageContent>
      </PlayDetailContext.Provider>
  )
}
