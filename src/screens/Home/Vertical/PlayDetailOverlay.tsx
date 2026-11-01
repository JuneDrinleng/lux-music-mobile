import { useSettingsTransition } from '@/components/common/SettingsPage'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { Animated, View } from 'react-native'
import PlayDetail from '@/screens/PlayDetail'
import { APP_LAYER_INDEX, COMPONENT_IDS } from '@/config/constant'
import { setBgPic, setComponentId } from '@/core/common'
import commonState from '@/store/common/state'
import { sharedLuxStyles } from '@/theme/LuxTheme'


export default memo(
  ({ componentId }: { componentId: string }) => {
    const styles = useLuxStyles()

    const { style: pageStyle, requestOpen, requestClose } = useSettingsTransition(false)
    const prevBgPicRef = useRef<string | null>(null)
    const [isVisible, setVisible] = useState(false)
    const [hasEverShown, setHasEverShown] = useState(false)
    const hidePlayDetail = useCallback(() => {
      if (!isVisible) return
      requestClose(() => {
        setVisible(false)
        // 关闭后恢复 bgPic（但若 init 代码已设置了新的就不再覆盖）
        if (commonState.bgPic === null) {
          setBgPic(prevBgPicRef.current)
        }
        setComponentId(COMPONENT_IDS.playDetail, '')
      })
    }, [isVisible, requestClose])

    const showPlayDetail = useCallback(() => {
      if (isVisible) return
      if (!hasEverShown) setHasEverShown(true)
      // 保存并清除全局 bgPic，防止 Home 背景变暗，避免黑色遮罩叠加显得更黑
      prevBgPicRef.current = commonState.bgPic
      setBgPic(null)
      setVisible(true)
      setComponentId(COMPONENT_IDS.playDetail, componentId)
      requestOpen()
    }, [isVisible, requestOpen, hasEverShown, componentId])

    useEffect(() => {
      global.app_event.on('showPlayDetail', showPlayDetail)
      global.app_event.on('hidePlayDetail', hidePlayDetail)
      return () => {
        global.app_event.off('showPlayDetail', showPlayDetail)
        global.app_event.off('hidePlayDetail', hidePlayDetail)
      }
    }, [hidePlayDetail, showPlayDetail])

    return (
      <View
        style={styles.container}
        pointerEvents={isVisible ? 'auto' : 'none'}
      >
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

const useLuxStyles = sharedLuxStyles(() => ({
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
  content: {
    flex: 1,
  },
}))
