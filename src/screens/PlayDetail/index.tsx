/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useCallback, useEffect } from 'react'
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
import PlayQueueSheet from '@/screens/Home/Vertical/PlayQueueSheet'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'

export default ({ componentId }: { componentId: string }) => {
  const isHorizontalMode = useHorizontalMode()
  const componentIds = useComponentIds()
  const bottomInset = useSystemGestureInsetBottom()

  useBackHandler(useCallback(() => {
    if (commonState.componentIds.comment) return false
    if (commonState.componentIds.playDetail !== componentId) return false
    void pop(componentId)
    return true
  }, [componentId]))

  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
      <PageContent>
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
  )
}
