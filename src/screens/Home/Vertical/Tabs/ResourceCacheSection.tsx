/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useState } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { SectionHeader, SettingRow } from '@/components/magazine'
import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { clearCache, getCacheSize, setMaxCacheSize } from '@/plugins/player/utils'
import { useSettingValue } from '@/store/setting/hook'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { sizeFormate } from '@/utils'
import { AUDIO_CACHE_STEPS_MB, formatAudioCacheLimit, formatImageCacheTick, IMAGE_CACHE_STEPS } from '@/utils/cacheLimitSteps'
import { clearMusicUrl } from '@/utils/data'
import { clearImageCacheFiles, getImageCacheSize, resetImageCache, scheduleImageCacheTrim, setImageCacheLimits } from '@/utils/imageCache'
import { getAppCacheSize, clearAppCache } from '@/utils/nativeModules/cache'
import { restorePlaylistCoverCache } from '@/utils/playlistCoverPrefetch'
import {
  confirmDialog,
  resetIgnoringBatteryOptimizationCheck,
  resetNotificationPermissionCheck,
  toast,
} from '@/utils/tools'

import { CacheLimitSlider } from './CacheLimitSlider'

const parseSettingNumber = (value: string | null | undefined, fallback: number) => {
  const parsed = parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

interface ResourceCacheDetailProps {
  styles?: Record<string, unknown>
  cacheSizeLabel: string
  cleaning: boolean
  cleaningAudio: boolean
  cleaningImage: boolean
  canClean: boolean
  audioCacheLabel: string
  imageCacheLabel: string
  onClean: () => void
  onCleanAudio: () => void
  onCleanImage: () => void
}

export const useResourceCache = () => {
  const t = useI18n()
  const [cleaning, setCleaning] = useState(false)
  const [cleaningAudio, setCleaningAudio] = useState(false)
  const [cleaningImage, setCleaningImage] = useState(false)
  const [cacheSize, setCacheSize] = useState<string | null>(null)
  const [audioCacheLabel, setAudioCacheLabel] = useState('')
  const [imageCacheLabel, setImageCacheLabel] = useState('')

  const handleGetAppCacheSize = useCallback(() => {
    void Promise.all([getAppCacheSize(), getCacheSize(), getImageCacheSize()]).then(([appSize, audioSize, imageSize]) => {
      setCacheSize(sizeFormate(appSize + audioSize))
      setAudioCacheLabel(t('setting_cache_audio_size', { size: sizeFormate(audioSize) }))
      setImageCacheLabel(t('setting_cache_image_size', { size: sizeFormate(imageSize) }))
    }).catch(() => {})
  }, [t])

  const handleCleanCache = useCallback(() => {
    if (cacheSize == null || cleaning) return
    void confirmDialog({
      message: t('confirm_tip'),
      confirmButtonText: t('list_remove_tip_button'),
    }).then(confirm => {
      if (!confirm) return
      setCleaning(true)
      void Promise.all([
        clearAppCache(),
        clearCache(),
        clearMusicUrl(),
        resetNotificationPermissionCheck(),
        resetIgnoringBatteryOptimizationCheck(),
      ]).then(() => {
        toast(t('setting_other_cache_clear_success_tip'))
      }).finally(() => {
        void resetImageCache().finally(() => {
          restorePlaylistCoverCache()
          handleGetAppCacheSize()
          setCleaning(false)
        })
      })
    })
  }, [cacheSize, cleaning, handleGetAppCacheSize, t])

  const handleCleanAudioCache = useCallback(() => {
    if (cleaningAudio) return
    void confirmDialog({
      message: t('setting_cache_audio_clear_confirm'),
      confirmButtonText: t('list_remove_tip_button'),
    }).then(confirm => {
      if (!confirm) return
      setCleaningAudio(true)
      void clearCache().then(() => {
        toast(t('setting_cache_audio_clear_success'))
      }).finally(() => {
        handleGetAppCacheSize()
        setCleaningAudio(false)
      })
    })
  }, [cleaningAudio, handleGetAppCacheSize, t])

  const handleCleanImageCache = useCallback(() => {
    if (cleaningImage) return
    void confirmDialog({
      message: t('setting_cache_image_clear_confirm'),
      confirmButtonText: t('list_remove_tip_button'),
    }).then(confirm => {
      if (!confirm) return
      setCleaningImage(true)
      void clearImageCacheFiles().then(() => {
        toast(t('setting_cache_image_clear_success'))
        restorePlaylistCoverCache()
      }).finally(() => {
        handleGetAppCacheSize()
        setCleaningImage(false)
      })
    })
  }, [cleaningImage, handleGetAppCacheSize, t])

  useEffect(() => {
    handleGetAppCacheSize()
  }, [handleGetAppCacheSize])

  const cacheSizeLabel = cacheSize == null
    ? t('setting_other_cache_getting')
    : t('setting_other_cache_size') + cacheSize

  return {
    cleaning,
    cleaningAudio,
    cleaningImage,
    cacheSize,
    cacheSizeLabel,
    audioCacheLabel,
    imageCacheLabel,
    handleCleanCache,
    handleCleanAudioCache,
    handleCleanImageCache,
    handleGetAppCacheSize,
  }
}

export const ResourceCacheDetail = memo(({
  cacheSizeLabel,
  cleaning,
  cleaningAudio,
  cleaningImage,
  canClean,
  audioCacheLabel,
  imageCacheLabel,
  onClean,
  onCleanAudio,
  onCleanImage,
}: ResourceCacheDetailProps) => {
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const cacheSizeSetting = useSettingValue('player.cacheSize')
  const imageCountSetting = useSettingValue('player.imageCacheCount')
  const audioLimit = parseSettingNumber(cacheSizeSetting, 1024)
  const imageLimit = parseSettingNumber(imageCountSetting, 400)
  const audioOffLabel = t('setting_cache_audio_off')
  const purple = r.iconWrap.purple

  const handleSelectAudioLimit = useCallback((mb: number) => {
    updateSetting({ 'player.cacheSize': String(mb) })
    void setMaxCacheSize(mb).catch(() => {
      toast(t('setting_play_cache_size_save_tip'))
    })
  }, [t])

  const handleSelectImageLimit = useCallback((count: number) => {
    updateSetting({ 'player.imageCacheCount': String(count) })
    setImageCacheLimits(count)
    scheduleImageCacheTrim()
  }, [])

  return (
    <View>
      <SectionHeader title={t('setting_cache_management')} meta="CACHE" showRule={false} />
      <Text size={15} color={r.list} style={{ fontWeight: '700', marginTop: 8, marginBottom: 4 }}>
        {cacheSizeLabel}
      </Text>
      <SettingRow
        icon="broom"
        iconBg={purple}
        title={t('setting_other_cache_clear_btn')}
        onPress={canClean && !cleaning ? onClean : undefined}
      />
      <Text size={12} color={r.muted} style={{ lineHeight: 18, marginVertical: 10 }}>
        {t('setting_cache_separate_note')}
      </Text>
      <SettingRow
        icon="waveform"
        iconBg={purple}
        title={t('setting_cache_audio_title')}
        subtitle={audioCacheLabel || t('setting_other_cache_getting')}
      />
      <SettingRow
        icon="music-note-off"
        iconBg={purple}
        title={t('setting_cache_audio_clear')}
        onPress={cleaningAudio ? undefined : onCleanAudio}
      />
      <SettingRow
        icon="image-multiple-outline"
        iconBg={purple}
        title={t('setting_cache_image_title')}
        subtitle={imageCacheLabel || t('setting_other_cache_getting')}
      />
      <SettingRow
        icon="image-off-outline"
        iconBg={purple}
        title={t('setting_cache_image_clear')}
        onPress={cleaningImage ? undefined : onCleanImage}
      />
      <CacheLimitSlider
        icon="harddisk"
        iconBg={purple}
        title={t('setting_cache_audio_limit')}
        steps={AUDIO_CACHE_STEPS_MB}
        value={audioLimit}
        formatTick={mb => formatAudioCacheLimit(mb, audioOffLabel)}
        formatChip={mb => formatAudioCacheLimit(mb, audioOffLabel)}
        onCommit={handleSelectAudioLimit}
      />
      <CacheLimitSlider
        icon="image-size-select-large"
        iconBg={purple}
        title={t('setting_cache_image_limit')}
        steps={IMAGE_CACHE_STEPS}
        value={imageLimit}
        formatTick={formatImageCacheTick}
        formatChip={count => t('setting_cache_image_count', { count })}
        onCommit={handleSelectImageLimit}
      />
      <SettingRow
        icon="folder-download-outline"
        iconBg={purple}
        title={t('setting_cache_open_local')}
        onPress={() => {
          global.app_event.closePlaylistDetail()
          global.app_event.openLocalSongs()
        }}
        last
      />
    </View>
  )
})
