import { memo, useEffect, useRef, useState } from 'react'
import { AppState, View } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Lyric from './Lyric'
import Pic from './Pic'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'

export default memo(({
  componentId,
}: {
  componentId: string
}) => {
  const [pageIndex, setPageIndex] = useState(0)
  const showLyricRef = useRef(false)

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setPageIndex(nativeEvent.position)
    showLyricRef.current = nativeEvent.position === 1
    if (showLyricRef.current) screenkeepAwake()
    else screenUnkeepAwake()
  }

  useEffect(() => {
    const appstateListener = AppState.addEventListener('change', state => {
      if (state === 'active') {
        if (showLyricRef.current && !commonState.componentIds.comment) screenkeepAwake()
      } else if (state === 'background') {
        screenUnkeepAwake()
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (showLyricRef.current && AppState.currentState === 'active') screenkeepAwake()
    }

    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)

    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      appstateListener.remove()
      screenUnkeepAwake()
    }
  }, [])

  return (
    <View style={styles.container}>
      <PagerView onPageSelected={onPageSelected} style={styles.pagerView}>
        <View collapsable={false}>
          <Pic componentId={componentId} active={pageIndex === 0} />
        </View>
        <View collapsable={false}>
          <Lyric active={pageIndex === 1} />
        </View>
      </PagerView>
    </View>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  pagerView: {
    flex: 1,
  },
})
