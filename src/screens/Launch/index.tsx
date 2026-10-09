/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, useEffect, useRef, useState } from 'react'
import { Animated, Easing, Image, View } from 'react-native'
import Text from '@/components/common/Text'
import { MagLoadingBar } from '@/components/magazine'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { storageDataPrefix } from '@/config/constant'
import { getData } from '@/plugins/storage'
import { getSyncHost } from '@/plugins/sync/data'
import defaultAvatar from '../../../assets/img/DefaultAvatar.png'

let launchSyncHint = false
const appVersion = process.versions?.app ?? '0.3.1'

export default memo(() => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const [showSyncHint, setShowSyncHint] = useState(launchSyncHint)
  const progress = useRef(new Animated.Value(0.28)).current

  useEffect(() => {
    let isUnmounted = false
    void Promise.all([
      getData<Partial<LX.AppSetting>>(storageDataPrefix.setting),
      getSyncHost(),
    ]).then(([setting, syncHost]) => {
      if (isUnmounted) return
      launchSyncHint = Boolean(setting?.['sync.enable'] && syncHost)
      setShowSyncHint(launchSyncHint)
    })
    return () => { isUnmounted = true }
  }, [])

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 0.72, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      Animated.timing(progress, { toValue: 0.32, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
    ]))
    loop.start()
    return () => { loop.stop() }
  }, [progress])

  return (
    <View style={[styles.container, { backgroundColor: r.paper }]}>
      <View style={styles.main}>
        <Image source={defaultAvatar} style={styles.mark} accessibilityIgnoresInvertColors />
        <Text size={magType.h1.size} color={r.display} style={styles.title}>Lux{'\n'}Music</Text>
        <Text
          size={magType.eyebrow.size}
          color={r.eyebrow}
          style={styles.issue}
        >{t('launch_issue', { version: appVersion })}</Text>
        <View style={[styles.rule, { backgroundColor: r.ink }]} />
        <Text size={15} color={r.muted} style={styles.tagline}>{t('launch_tagline')}</Text>
        {showSyncHint
          ? <View style={styles.syncHint}><MagLoadingBar label="SYNC" /></View>
          : null}
      </View>
      <View style={styles.footer}>
        <View style={[styles.track, { backgroundColor: r.hairline }]}>
          <Animated.View
            style={[styles.fill, {
              backgroundColor: r.ink,
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            }]}
          />
        </View>
      </View>
    </View>
  )
})

const useStyles = sharedLuxStyles(() => createStyle({
  container: {
    flex: 1,
    paddingHorizontal: PAGE_GUTTER,
    paddingTop: 72,
    paddingBottom: 36,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
  },
  mark: {
    width: 56,
    height: 56,
    borderRadius: 12,
    marginBottom: 22,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 44,
  },
  issue: {
    marginTop: 14,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  rule: {
    height: 1,
    marginTop: 22,
    opacity: 0.9,
  },
  tagline: {
    marginTop: 14,
    lineHeight: 22,
  },
  syncHint: {
    marginTop: 18,
    marginHorizontal: -PAGE_GUTTER,
  },
  footer: {
    paddingBottom: 8,
  },
  track: {
    height: 2,
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    height: 2,
  },
}))
