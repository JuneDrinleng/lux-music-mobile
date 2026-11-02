import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Easing, View } from 'react-native'
import PlayDetail from '@/screens/PlayDetail'
import { APP_LAYER_INDEX, COMPONENT_IDS } from '@/config/constant'
import { setBgPic, setComponentId } from '@/core/common'
import { useWindowSize } from '@/utils/hooks'
import commonState from '@/store/common/state'
import { sharedLuxStyles } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'

const ANIM_IN_DURATION = 420
const ANIM_OUT_DURATION = 300

export default memo(
  ({ componentId }: { componentId: string }) => {
    const styles = useLuxStyles()

    const animValue = useRef(new Animated.Value(0)).current
    const phase = useRef<'hidden' | 'opening' | 'open' | 'closing'>('hidden')
    const generation = useRef(0)
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
      if (phase.current === 'hidden' || phase.current === 'closing') return
      phase.current = 'closing'
      const current = ++generation.current
      animValue.stopAnimation()
      Animated.timing(animValue, {
        toValue: 0,
        duration: ANIM_OUT_DURATION,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || generation.current !== current) return
        phase.current = 'hidden'
        setVisible(false)
        // 关闭后恢复 bgPic（但若 init 代码已设置了新的就不再覆盖）
        if (commonState.bgPic === null) {
          setBgPic(prevBgPicRef.current)
        }
        setComponentId(COMPONENT_IDS.playDetail, '')
      })
    }, [animValue])

    const showPlayDetail = useCallback(() => {
      if (phase.current === 'opening' || phase.current === 'open') return
      const wasHidden = phase.current === 'hidden'
      phase.current = 'opening'
      const current = ++generation.current
      setHasEverShown(true)
      // 重开退出中的页面时保留原背景快照，从当前位置反向进入。
      if (wasHidden) {
        prevBgPicRef.current = commonState.bgPic
        setBgPic(null)
      }
      setVisible(true)
      setComponentId(COMPONENT_IDS.playDetail, componentId)
      animValue.stopAnimation()
      if (wasHidden) animValue.setValue(0)
      Animated.timing(animValue, {
        toValue: 1,
        duration: ANIM_IN_DURATION,
        easing: Easing.out(Easing.back(1.05)),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && generation.current === current) phase.current = 'open'
      })
    }, [animValue, componentId])

    useEffect(() => {
      global.app_event.on('showPlayDetail', showPlayDetail)
      global.app_event.on('hidePlayDetail', hidePlayDetail)
      return () => {
        global.app_event.off('showPlayDetail', showPlayDetail)
        global.app_event.off('hidePlayDetail', hidePlayDetail)
      }
    }, [hidePlayDetail, showPlayDetail])

    useEffect(() => () => {
      ++generation.current
      animValue.stopAnimation()
      if (phase.current !== 'hidden') {
        if (commonState.bgPic === null) setBgPic(prevBgPicRef.current)
        setComponentId(COMPONENT_IDS.playDetail, '')
      }
    }, [animValue])

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
