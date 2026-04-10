import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, Platform, StyleSheet, TouchableOpacity, UIManager, View } from 'react-native'
import { BlurView } from '@react-native-community/blur'
import { House, ListMusic, Settings2, type LucideIcon } from 'lucide-react-native'
import { useNavActiveId } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'
import { setNavActiveId } from '@/core/common'
import type { InitState } from '@/store/common/state'
import { useI18n } from '@/lang'

const hasNativeBlurView = Boolean(UIManager.getViewManagerConfig?.(Platform.OS === 'ios' ? 'BlurView' : 'AndroidBlurView'))

const tabs = [
  { id: 'nav_search', icon: House, labelKey: 'nav_search' },
  { id: 'nav_love', icon: ListMusic, labelKey: 'nav_love' },
  { id: 'nav_setting', icon: Settings2, labelKey: 'nav_setting' },
] as const
const ACTIVE_ORB_SIZE = 52
const ACTIVE_ALIGNMENT_SHIFT_MAP: Record<TabId, number> = {
  nav_search: 2.25,
  nav_love: 3.25,
  nav_setting: 2.25,
}

type TabId = InitState['navActiveId']

const TabItem = ({ id, icon: Icon, label, active, compact = false, onPress, onLayout }: {
  id: TabId
  icon: LucideIcon
  label: string
  active: boolean
  compact?: boolean
  onPress: (id: TabId) => void
  onLayout?: (id: TabId, x: number, width: number) => void
}) => {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.item, compact ? styles.itemCompact : null]}
      activeOpacity={0.82}
      onPress={() => { onPress(id) }}
      onLayout={(event) => {
        onLayout?.(id, event.nativeEvent.layout.x, event.nativeEvent.layout.width)
      }}
    >
      <View style={[
        styles.iconOrb,
        compact ? styles.iconOrbCompact : null,
        active ? styles.iconOrbActive : styles.iconOrbIdle,
      ]}>
        <View style={active ? { transform: [{ translateX: ACTIVE_ALIGNMENT_SHIFT_MAP[id] }] } : null}>
          <Icon
            size={compact ? 18 : active ? 22 : 20}
            color={active ? '#2a311c' : '#5f6574'}
            strokeWidth={active ? 2.25 : 2}
          />
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default memo(({ bottomInset = 0, inCard = false }: { bottomInset?: number, inCard?: boolean }) => {
  const t = useI18n()
  const activeId = useNavActiveId()
  const shouldUseBlur = !inCard && hasNativeBlurView
  const [isSearchPageVisible, setSearchPageVisible] = useState(false)
  const [itemLayouts, setItemLayouts] = useState<Partial<Record<TabId, { x: number, width: number }>>>({})
  const indicatorX = useRef(new Animated.Value(0)).current
  const indicatorOpacity = useRef(new Animated.Value(0)).current
  const hasAnimatedRef = useRef(false)

  const handlePress = (id: TabId) => {
    if (isSearchPageVisible) global.app_event.closeVerticalSearchPage()
    if (activeId === id) return
    setNavActiveId(id)
  }
  const handleItemLayout = (id: TabId, x: number, width: number) => {
    setItemLayouts((prev) => {
      const current = prev[id]
      if (current && current.x === x && current.width === width) return prev
      return {
        ...prev,
        [id]: { x, width },
      }
    })
  }
  const hasIndicator = !inCard && !isSearchPageVisible && Boolean(itemLayouts[activeId])

  useEffect(() => {
    const handleSearchPageVisibleChanged = (visible: boolean) => {
      setSearchPageVisible(visible)
    }
    global.app_event.on('verticalSearchPageVisibleChanged', handleSearchPageVisibleChanged)
    return () => {
      global.app_event.off('verticalSearchPageVisibleChanged', handleSearchPageVisibleChanged)
    }
  }, [])

  useEffect(() => {
    if (isSearchPageVisible) {
      indicatorOpacity.setValue(0)
      return
    }
    const activeLayout = itemLayouts[activeId]
    if (!activeLayout) return

    const nextX = activeLayout.x + activeLayout.width / 2 - ACTIVE_ORB_SIZE / 2 + ACTIVE_ALIGNMENT_SHIFT_MAP[activeId]
    if (!hasAnimatedRef.current) {
      indicatorX.setValue(nextX)
      indicatorOpacity.setValue(1)
      hasAnimatedRef.current = true
      return
    }

    Animated.parallel([
      Animated.timing(indicatorX, {
        toValue: nextX,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(indicatorOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start()
  }, [activeId, indicatorOpacity, indicatorX, isSearchPageVisible, itemLayouts])

  return (
    <View style={[styles.shell, inCard ? styles.shellInCard : null, { paddingBottom: inCard ? 4 : 10 + bottomInset }]}>
      <View style={[styles.rail, inCard ? styles.railInCard : null]}>
        {shouldUseBlur
          ? <>
              <BlurView
                style={StyleSheet.absoluteFillObject}
                blurType={Platform.OS === 'ios' ? 'chromeMaterialLight' : 'light'}
                blurAmount={Platform.OS === 'ios' ? 36 : 24}
                blurRadius={Platform.OS === 'android' ? 24 : undefined}
                downsampleFactor={Platform.OS === 'android' ? 6 : undefined}
                overlayColor={Platform.OS === 'android' ? 'rgba(255,255,255,0.18)' : 'transparent'}
                reducedTransparencyFallbackColor="rgba(255,255,255,0.7)"
              />
              <View style={styles.glassTint} pointerEvents="none" />
            </>
          : <View style={styles.glassFallback} pointerEvents="none" />}
        <View style={styles.glassRim} pointerEvents="none" />

        <View style={[styles.contentRow, inCard ? styles.contentRowCompact : null]}>
          {hasIndicator
            ? <Animated.View
                pointerEvents="none"
                style={[
                  styles.activeOrbIndicator,
                  {
                    opacity: indicatorOpacity,
                    transform: [{ translateX: indicatorX }],
                  },
                ]}
              />
            : null}
          {tabs.map(tab => (
            <TabItem
              key={tab.id}
              id={tab.id}
              icon={tab.icon}
              label={t(tab.labelKey)}
              active={!isSearchPageVisible && activeId === tab.id}
              compact={inCard}
              onPress={handlePress}
              onLayout={handleItemLayout}
            />
          ))}
        </View>
      </View>
    </View>
  )
})

const styles = createStyle({
  shell: {
    paddingHorizontal: 14,
    paddingTop: 1,
    backgroundColor: 'transparent',
  },
  shellInCard: {
    paddingHorizontal: 8,
    paddingTop: 0,
  },
  rail: {
    minHeight: 74,
    maxWidth: 328,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(244,247,252,0.58)',
    backgroundColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#81889a',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  railInCard: {
    minHeight: 58,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  glassTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  glassFallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.62)',
  },
  glassRim: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  contentRow: {
    height: ACTIVE_ORB_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  contentRowCompact: {
    height: 36,
  },
  activeOrbIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: ACTIVE_ORB_SIZE,
    height: ACTIVE_ORB_SIZE,
    borderRadius: ACTIVE_ORB_SIZE / 2,
    backgroundColor: '#d7ef59',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    shadowColor: '#b5cc49',
    shadowOpacity: 0.34,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  item: {
    flex: 1,
    height: ACTIVE_ORB_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCompact: {
    flex: 0,
    height: 36,
    minWidth: 56,
  },
  iconOrb: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconOrbCompact: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  iconOrbIdle: {
    backgroundColor: 'transparent',
  },
  iconOrbActive: {
    backgroundColor: 'transparent',
  },
})
