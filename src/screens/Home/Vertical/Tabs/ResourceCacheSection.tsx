/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { useI18n } from '@/lang'
import { clearCache, getCacheSize, setMaxCacheSize } from '@/plugins/player/utils'
import { sizeFormate } from '@/utils'
import { clearMusicUrl } from '@/utils/data'
import { getAppCacheSize, clearAppCache } from '@/utils/nativeModules/cache'
import { clearImageCacheFiles, getImageCacheSize, resetImageCache, scheduleImageCacheTrim, setImageCacheLimits } from '@/utils/imageCache'
import { useLuxTheme } from '@/theme/LuxTheme'
import { restorePlaylistCoverCache } from '@/utils/playlistCoverPrefetch'
import { confirmDialog, resetIgnoringBatteryOptimizationCheck, resetNotificationPermissionCheck, toast } from '@/utils/tools'
import { updateSetting } from '@/core/common'
import { useSettingValue } from '@/store/setting/hook'
import { AUDIO_CACHE_STEPS_MB, formatAudioCacheLimit, formatImageCacheTick, IMAGE_CACHE_STEPS } from '@/utils/cacheLimitSteps'
import { CacheLimitSlider } from './CacheLimitSlider'

const parseSettingNumber = (value: string | null | undefined, fallback: number) => {
  const parsed = parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

interface ResourceCacheDetailProps {
  styles: Record<string, any>
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

interface CacheIconRowProps {
  styles: Record<string, any>
  icon: string
  title: string
  subtitle?: string
  disabled?: boolean
  onPress?: () => void
}

const CacheIconRow = ({ styles, icon, title, subtitle, disabled, onPress }: CacheIconRowProps) => {
  const { colors } = useLuxTheme()
  const body = (
    <View style={styles.groupRowLeft}>
      <View style={[styles.groupRowIconWrap, styles.iconWrapPurple]}>
        <MdiIcon name={icon} size={24} color={colors.ink.icon} />
      </View>
      <View style={styles.groupRowTextWrap}>
        <Text size={15} color={disabled ? colors.ink.quiet : colors.ink.list} style={styles.groupRowTitle}>{title}</Text>
        {subtitle
          ? <Text size={12} color={colors.ink.secondary} numberOfLines={4}>{subtitle}</Text>
          : null}
      </View>
    </View>
  )
  if (!onPress) return <View style={styles.optionDetailRow}>{body}</View>
  return (
    <TouchableOpacity style={styles.optionDetailRow} activeOpacity={0.84} onPress={onPress} disabled={disabled}>
      {body}
    </TouchableOpacity>
  )
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
  styles: parentStyles,
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
  const cacheSizeSetting = useSettingValue('player.cacheSize')
  const imageCountSetting = useSettingValue('player.imageCacheCount')
  const audioLimit = parseSettingNumber(cacheSizeSetting, 1024)
  const imageLimit = parseSettingNumber(imageCountSetting, 400)
  const audioOffLabel = t('setting_cache_audio_off')

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
    <>
      <View style={parentStyles.optionDetailRow}>
        <Text size={15} color={colors.ink.list} style={[parentStyles.groupRowTitle, parentStyles.optionDetailLabel]}>{cacheSizeLabel}</Text>
      </View>
      <View style={parentStyles.optionDetailDivider} />
      <TouchableOpacity
        style={parentStyles.optionDetailRow}
        activeOpacity={0.84}
        onPress={onClean}
        disabled={!canClean || cleaning}
      >
        <Text size={15} color={cleaning ? colors.ink.quiet : colors.ink.list} style={[parentStyles.groupRowTitle, parentStyles.optionDetailLabel]}>
          {t('setting_other_cache_clear_btn')}
        </Text>
      </TouchableOpacity>
      <View style={parentStyles.optionDetailDivider} />
      <View style={parentStyles.optionDetailRow}>
        <Text size={12} color={colors.ink.secondary} style={parentStyles.optionDetailLabel}>{t('setting_cache_separate_note')}</Text>
      </View>
      <View style={parentStyles.optionDetailDivider} />
      <CacheIconRow styles={parentStyles} icon="waveform" title={t('setting_cache_audio_title')} subtitle={audioCacheLabel || t('setting_other_cache_getting')} />
      <View style={parentStyles.optionDetailDivider} />
      <CacheIconRow
        styles={parentStyles}
        icon="music-note-off"
        title={t('setting_cache_audio_clear')}
        disabled={cleaningAudio}
        onPress={onCleanAudio}
      />
      <View style={parentStyles.optionDetailDivider} />
      <CacheIconRow styles={parentStyles} icon="image-multiple-outline" title={t('setting_cache_image_title')} subtitle={imageCacheLabel || t('setting_other_cache_getting')} />
      <View style={parentStyles.optionDetailDivider} />
      <CacheIconRow
        styles={parentStyles}
        icon="image-off-outline"
        title={t('setting_cache_image_clear')}
        disabled={cleaningImage}
        onPress={onCleanImage}
      />
      <View style={parentStyles.optionDetailDivider} />
      <CacheLimitSlider
        styles={parentStyles}
        icon="harddisk"
        title={t('setting_cache_audio_limit')}
        steps={AUDIO_CACHE_STEPS_MB}
        value={audioLimit}
        formatTick={mb => formatAudioCacheLimit(mb, audioOffLabel)}
        formatChip={mb => formatAudioCacheLimit(mb, audioOffLabel)}
        onCommit={handleSelectAudioLimit}
      />
      <View style={parentStyles.optionDetailDivider} />
      <CacheLimitSlider
        styles={parentStyles}
        icon="image-size-select-large"
        title={t('setting_cache_image_limit')}
        steps={IMAGE_CACHE_STEPS}
        value={imageLimit}
        formatTick={formatImageCacheTick}
        formatChip={count => t('setting_cache_image_count', { count })}
        onCommit={handleSelectImageLimit}
      />
      <View style={parentStyles.optionDetailDivider} />
      <CacheIconRow
        styles={parentStyles}
        icon="file-music-outline"
        title={t('setting_cache_open_local')}
        onPress={() => {
          global.app_event.closePlaylistDetail()
          global.app_event.openLocalSongs()
        }}
      />
    </>
  )
})
