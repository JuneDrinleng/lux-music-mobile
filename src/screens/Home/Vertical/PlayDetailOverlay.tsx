import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, View } from 'react-native'
import PlayDetail from '@/screens/PlayDetail'
import { APP_LAYER_INDEX, COMPONENT_IDS } from '@/config/constant'
import { setBgPic, setComponentId } from '@/core/common'
import { useWindowSize } from '@/utils/hooks'
import commonState from '@/store/common/state'

const ANIM_IN_DURATION = 420
const ANIM_OUT_DURATION = 300

export default memo(
  ({ componentId }: { componentId: string }) => {
    const animValue = useRef(new Animated.Value(0)).current
    const prevBgPicRef = useRef<string | null>(null)
    const [isVisible, setVisible] = useState(false)
    const [hasEverShown, setHasEverShown] = useState(false)
    const windowSize = useWindowSize()
    const screenHeight = windowSize.height

    const translateY = useMemo(() => animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [screenHeight, 0],
      extrapolate: 'clamp',
    }), [animValue, screenHeight])

    const hidePlayDetail = useCallback(() => {
      if (!isVisible) return
      animValue.stopAnimation()
      Animated.timing(animValue, {
        toValue: 0,
        duration: ANIM_OUT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return
        setVisible(false)
        // 关闭后恢复 bgPic（但若 init 代码已设置了新的就不再覆盖）
        if (commonState.bgPic === null) {
          setBgPic(prevBgPicRef.current)
        }
        setComponentId(COMPONENT_IDS.playDetail, '')
      })
    }, [isVisible, animValue])

    const showPlayDetail = useCallback(() => {
      if (isVisible) return
      if (!hasEverShown) setHasEverShown(true)
      // 保存并清除全局 bgPic，防止 Home 背景变暗，避免黑色遮罩叠加显得更黑
      prevBgPicRef.current = commonState.bgPic
      setBgPic(null)
      setVisible(true)
      setComponentId(COMPONENT_IDS.playDetail, componentId)
      animValue.stopAnimation()
      animValue.setValue(0)
      Animated.timing(animValue, {
        toValue: 1,
        duration: ANIM_IN_DURATION,
        easing: Easing.out(Easing.back(1.05)),
        useNativeDriver: true,
      }).start()
    }, [isVisible, animValue, hasEverShown, componentId])

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
          style={[styles.mask, { opacity: animValue }]}
          pointerEvents={isVisible ? 'auto' : 'none'}
        />
        <Animated.View
          style={[
            styles.content,
            { transform: [{ translateY }] },
          ]}
        >
          {hasEverShown ? (
            <PlayDetail
              componentId={componentId}
              onClose={hidePlayDetail}
            />
          ) : null}
        </Animated.View>
      </View>
    )
  },
)

const styles = {
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
    backgroundColor: '#000000',
  },
  content: {
    flex: 1,
  },
}
