/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { useI18n } from '@/lang'
import { clearCache, getCacheSize } from '@/plugins/player/utils'
import { sizeFormate } from '@/utils'
import { clearMusicUrl } from '@/utils/data'
import { getAppCacheSize, clearAppCache } from '@/utils/nativeModules/cache'
import { confirmDialog, resetIgnoringBatteryOptimizationCheck, resetNotificationPermissionCheck, toast } from '@/utils/tools'

interface ResourceCacheSectionProps {
  styles: Record<string, any>
  cacheSizeLabel: string
  onPress: () => void
}

interface ResourceCacheDetailProps {
  styles: Record<string, any>
  cacheSizeLabel: string
  cleaning: boolean
  canClean: boolean
  onClean: () => void
}

export const useResourceCache = () => {
  const t = useI18n()
  const [cleaning, setCleaning] = useState(false)
  const [cacheSize, setCacheSize] = useState<string | null>(null)

  const handleGetAppCacheSize = useCallback(() => {
    void Promise.all([getAppCacheSize(), getCacheSize()]).then(([size, size2]) => {
      setCacheSize(sizeFormate(size + size2))
    })
  }, [])

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
        handleGetAppCacheSize()
        setCleaning(false)
      })
    })
  }, [cacheSize, cleaning, handleGetAppCacheSize, t])

  useEffect(() => {
    handleGetAppCacheSize()
  }, [handleGetAppCacheSize])

  const cacheSizeLabel = cacheSize == null
    ? t('setting_other_cache_getting')
    : t('setting_other_cache_size') + cacheSize

  return {
    cleaning,
    cacheSize,
    cacheSizeLabel,
    handleCleanCache,
    handleGetAppCacheSize,
  }
}

export const ResourceCacheDetail = memo(({
  styles: parentStyles,
  cacheSizeLabel,
  cleaning,
  canClean,
  onClean,
}: ResourceCacheDetailProps) => {
  const t = useI18n()
  return (
    <>
      <View style={parentStyles.optionDetailRow}>
        <Text size={15} color="#20242d" style={[parentStyles.groupRowTitle, parentStyles.optionDetailLabel]}>{cacheSizeLabel}</Text>
      </View>
      <View style={parentStyles.optionDetailDivider} />
      <TouchableOpacity
        style={parentStyles.optionDetailRow}
        activeOpacity={0.84}
        onPress={onClean}
        disabled={!canClean || cleaning}
      >
        <Text size={15} color={cleaning ? '#9aa1ae' : '#20242d'} style={[parentStyles.groupRowTitle, parentStyles.optionDetailLabel]}>
          {t('setting_other_cache_clear_btn')}
        </Text>
      </TouchableOpacity>
    </>
  )
})

export default memo(({ styles: parentStyles, cacheSizeLabel, onPress }: ResourceCacheSectionProps) => {
  const t = useI18n()
  return (
    <View style={parentStyles.sectionCard}>
      <Text size={11} color="#838995" style={parentStyles.sectionEyebrow}>{t('setting__other_resource_cache')}</Text>
      <View style={parentStyles.sectionGroup}>
        <TouchableOpacity style={parentStyles.groupRow} activeOpacity={0.84} onPress={onPress}>
          <View style={parentStyles.groupRowLeft}>
            <View style={parentStyles.groupRowIconWrap}>
              <Icon name="broom" rawSize={18} color="#000000" />
            </View>
            <View style={parentStyles.groupRowTextWrap}>
              <Text size={15} color="#20242d" style={parentStyles.groupRowTitle}>{t('setting__other_resource_cache')}</Text>
              <Text size={12} color="#767d89" numberOfLines={2}>{cacheSizeLabel}</Text>
            </View>
          </View>
          <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
        </TouchableOpacity>
      </View>
    </View>
  )
})
