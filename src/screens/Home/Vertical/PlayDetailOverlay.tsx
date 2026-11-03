import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Animated, View } from 'react-native'
import PlayDetail from '@/screens/PlayDetail'
import { APP_LAYER_INDEX, COMPONENT_IDS } from '@/config/constant'
import { setBgPic, setComponentId } from '@/core/common'
import { useWindowSize } from '@/utils/hooks'
import commonState from '@/store/common/state'
import { sharedLuxStyles } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'

import { useBottomPopupTransition } from '@/components/common/bottomPopupTransition'

export default memo(
  ({ componentId }: { componentId: string }) => {
    const styles = useLuxStyles()

    const prevBgPicRef = useRef<string | null>(null)
    const [isVisible, setVisible] = useState(false)
    const [hasEverShown, setHasEverShown] = useState(false)
    const windowSize = useWindowSize()
    const screenHeight = windowSize.height

    const { style: pageStyle, progress: animValue, phase, requestOpen, requestClose } = useBottomPopupTransition(screenHeight, 'player')

    const hidePlayDetail = useCallback(() => {
      requestClose(() => {
        setVisible(false)
        // 关闭后恢复 bgPic（但若 init 代码已设置了新的就不再覆盖）
        if (commonState.bgPic === null) {
          setBgPic(prevBgPicRef.current)
        }
        setComponentId(COMPONENT_IDS.playDetail, '')
      })
    }, [requestClose])

    const showPlayDetail = useCallback(() => {
      requestOpen(wasHidden => {
        setHasEverShown(true)
        // 重开退出中的页面时保留原背景快照，从当前位置反向进入。
        if (wasHidden) {
          prevBgPicRef.current = commonState.bgPic
          setBgPic(null)
        }
        setVisible(true)
        setComponentId(COMPONENT_IDS.playDetail, componentId)
      })
    }, [requestOpen, componentId])

    useEffect(() => {
      global.app_event.on('showPlayDetail', showPlayDetail)
      global.app_event.on('hidePlayDetail', hidePlayDetail)
      return () => {
        global.app_event.off('showPlayDetail', showPlayDetail)
        global.app_event.off('hidePlayDetail', hidePlayDetail)
      }
    }, [hidePlayDetail, showPlayDetail])

    useEffect(() => () => {
      if (phase.current !== 'hidden') {
        if (commonState.bgPic === null) setBgPic(prevBgPicRef.current)
        setComponentId(COMPONENT_IDS.playDetail, '')
      }
    }, [phase])

    return (
      <View
        style={styles.container}
        pointerEvents={isVisible ? 'auto' : 'none'}
      >
        <Animated.View
          style={[styles.mask, { opacity: animValue }]}
          pointerEvents={isVisible ? 'auto' : 'none'}
        />
        <Animated.View
          style={[
            styles.content,
            pageStyle,
          ]}
        >
          {hasEverShown ? (
            <PlayDetail
              componentId={componentId}
              onClose={hidePlayDetail}
              visible={isVisible}
            />
          ) : null}
        </Animated.View>
      </View>
    )
  },
)

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => ({
  container: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: APP_LAYER_INDEX.playDetail,
    elevation: 0,
    overflow: 'hidden' as const,
  },
  mask: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim.mask,
  },
  content: {
    flex: 1,
  },
}))
