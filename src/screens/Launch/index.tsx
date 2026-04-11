/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, useEffect, useState } from 'react'
import { Image, StyleSheet, View } from 'react-native'
import Loading from '@/components/common/Loading'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { storageDataPrefix } from '@/config/constant'
import { getData } from '@/plugins/storage'
import { getSyncHost } from '@/plugins/sync/data'

const STATUS_TEXT = 'Sync...'

export default memo(() => {
  const theme = useTheme()
  const [showSyncHint, setShowSyncHint] = useState(false)

  useEffect(() => {
    let isUnmounted = false

    void Promise.all([
      getData<Partial<LX.AppSetting>>(storageDataPrefix.setting),
      getSyncHost(),
    ]).then(([setting, syncHost]) => {
      if (isUnmounted) return
      setShowSyncHint(Boolean(setting?.['sync.enable'] && syncHost))
    })

    return () => {
      isUnmounted = true
    }
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
      <View style={styles.main}>
        <View
          style={[
            styles.mark,
            {
              backgroundColor: theme['c-main-background'],
              borderColor: theme['c-border-background'],
            },
          ]}
        >
          <Image
            source={require('../../../assets/img/whitebg.png')}
            style={styles.markImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.title} size={26}>Lux Music</Text>
        {
          showSyncHint ? (
            <View style={styles.syncHint}>
              <Loading size={14} />
              <Text style={styles.syncHintText} size={12} color={theme['c-font-label']}>
                {STATUS_TEXT}
              </Text>
            </View>
          ) : null
        }
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: scaleSizeW(24),
    paddingTop: scaleSizeH(40),
    paddingBottom: scaleSizeH(28),
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    width: scaleSizeW(92),
    height: scaleSizeW(92),
    borderRadius: scaleSizeW(18),
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  markImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    marginTop: scaleSizeH(18),
    fontWeight: '600',
  },
  syncHint: {
    marginTop: scaleSizeH(12),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  syncHintText: {
    marginLeft: scaleSizeW(8),
  },
})
