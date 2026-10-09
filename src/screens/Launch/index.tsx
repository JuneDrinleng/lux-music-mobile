/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, useEffect, useState } from 'react'
import { Image, View } from 'react-native'
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

/** ~40% of content width on a 375 baseline (content ≈ 331 with PAGE_GUTTER 22). */
const SYNC_TRACK_WIDTH = 150

export default memo(() => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const [showSyncHint, setShowSyncHint] = useState(launchSyncHint)

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

  return (
    <View style={[styles.container, { backgroundColor: r.paper }]}>
      <View style={styles.main}>
        <Image source={defaultAvatar} style={styles.mark} accessibilityIgnoresInvertColors />
        <Text size={magType.h1.size} color={r.display} style={styles.title}>Lux{'\n'}Music</Text>
        <Text size={15} color={r.muted} style={styles.tagline}>{t('launch_tagline')}</Text>
        {showSyncHint
          ? (
            <View style={styles.syncHint}>
              <MagLoadingBar label="SYNC" trackWidth={SYNC_TRACK_WIDTH} />
            </View>
            )
          : null}
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
  tagline: {
    marginTop: 14,
    lineHeight: 22,
  },
  syncHint: {
    marginTop: 18,
    alignSelf: 'flex-start',
  },
}))
