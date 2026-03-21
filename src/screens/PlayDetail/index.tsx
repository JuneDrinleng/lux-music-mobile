import { useCallback, useEffect, useRef, useState } from 'react'
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

export default ({ componentId }: { componentId: string }) => {
  const isHorizontalMode = useHorizontalMode()
  const verticalPageIndexRef = useRef(0)
  const [backToPicSignal, setBackToPicSignal] = useState(0)

  const handleVerticalPageIndexChange = useCallback((index: number) => {
    verticalPageIndexRef.current = index
  }, [])

  useBackHandler(useCallback(() => {
    if (commonState.componentIds.comment) return false
    if (commonState.componentIds.playDetail !== componentId) return false
    if (!isHorizontalMode && verticalPageIndexRef.current === 1) {
      setBackToPicSignal(signal => signal + 1)
      return true
    }
    void pop(componentId)
    return true
  }, [componentId, isHorizontalMode]))

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
            : <Vertical componentId={componentId} onPageIndexChange={handleVerticalPageIndexChange} backToPicSignal={backToPicSignal} />
        }
      </PageContent>
  )
}
