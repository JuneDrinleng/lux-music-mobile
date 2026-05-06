/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { AppState, View } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Lyric from './Lyric'
import Pic from './Pic'
import Comment from '@/screens/Comment'
import { createStyle } from '@/utils/tools'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'

export default memo(({
  componentId,
}: {
  componentId: string
}) => {
  const [pageIndex, setPageIndex] = useState(1)
  const [commentRefreshKey, setCommentRefreshKey] = useState(0)
  const showLyricRef = useRef(false)
  const pagerViewRef = useRef<PagerView>(null)

  const triggerCommentRefresh = useCallback(() => {
    setCommentRefreshKey(k => k + 1)
  }, [])

  const onCommentBack = useCallback(() => {
    pagerViewRef.current?.setPage(1)
  }, [])

  const onPicCommentPress = useCallback(() => {
    pagerViewRef.current?.setPage(0)
  }, [])

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    const position = nativeEvent.position
    setPageIndex(position)
    showLyricRef.current = position === 2
    if (showLyricRef.current) screenkeepAwake()
    else screenUnkeepAwake()
    if (position === 0) triggerCommentRefresh()
  }

  useBackHandler(useCallback(() => {
    if (pageIndex === 0) {
      pagerViewRef.current?.setPage(1)
      return true
    }
    return false
  }, [pageIndex]))

  useEffect(() => {
    const appstateListener = AppState.addEventListener('change', state => {
      if (state === 'active') {
        if (showLyricRef.current) screenkeepAwake()
      } else if (state === 'background') {
        screenUnkeepAwake()
      }
    })

    return () => {
      appstateListener.remove()
      screenUnkeepAwake()
    }
  }, [])

  return (
    <View style={styles.container}>
      <PagerView ref={pagerViewRef} initialPage={1} onPageSelected={onPageSelected} style={styles.pagerView}>
        <View collapsable={false}>
          <Comment embedded onBack={onCommentBack} refreshKey={commentRefreshKey} />
        </View>
        <View collapsable={false}>
          <Pic componentId={componentId} active={pageIndex === 1} onCommentPress={onPicCommentPress} />
        </View>
        <View collapsable={false}>
          <Lyric active={pageIndex === 2} />
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
