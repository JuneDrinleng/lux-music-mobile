/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useEffect, useRef } from 'react'
import { Animated, View } from 'react-native'

import Text from '@/components/common/Text'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { COVER_LIST, PAGE_GUTTER, magType } from '@/theme/magazineType'

import { Hairline } from './Hairline'

export const SkeletonRow = memo(({ last = false }: { last?: boolean }) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const pulse = useRef(new Animated.Value(0.45)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.45, duration: 700, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [pulse])
  return (
    <View>
      <Animated.View style={{ opacity: pulse, flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 }}>
        <View style={{ width: COVER_LIST, height: COVER_LIST, borderRadius: 6, backgroundColor: r.skeleton }} />
        <View style={{ flex: 1, gap: 8 }}>
          <View style={{ height: 12, width: '72%', borderRadius: 2, backgroundColor: r.skeleton }} />
          <View style={{ height: 10, width: '48%', borderRadius: 2, backgroundColor: r.skeleton }} />
        </View>
      </Animated.View>
      {last ? null : <Hairline />}
    </View>
  )
})

export const MagLoadingBar = memo(({ label = 'LOADING' }: { label?: string }) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const slide = useRef(new Animated.Value(0)).current
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(slide, {
      toValue: 1,
      duration: 1100,
      useNativeDriver: true,
    }))
    loop.start()
    return () => loop.stop()
  }, [slide])
  return (
    <View style={{ paddingHorizontal: PAGE_GUTTER, paddingVertical: 18 }}>
      <Text
        size={magType.eyebrow.size}
        color={r.eyebrow}
        style={{ fontWeight: '700', letterSpacing: 2, marginBottom: 10 }}
      >{label}</Text>
      <View style={{ height: 2, backgroundColor: r.hairline, overflow: 'hidden' }}>
        <Animated.View style={{
          width: '30%',
          height: 2,
          backgroundColor: r.ink,
          transform: [{
            translateX: slide.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 240],
            }),
          }],
        }} />
      </View>
    </View>
  )
})
