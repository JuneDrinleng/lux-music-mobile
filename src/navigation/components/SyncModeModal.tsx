/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import {
  Checkbox,
  Hairline,
  PrimaryButton,
  Rule,
  SecondaryButton,
} from '@/components/magazine'
import { setSyncModeComponentId } from '@/core/sync'
import { useI18n } from '@/lang'
import syncState from '@/store/sync/state'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

type BaseSyncMode = 'merge_local_remote' | 'merge_remote_local' | 'overwrite_local_remote' | 'overwrite_remote_local'

const modeOptions: Array<{
  mode: BaseSyncMode | 'full_overwrite'
  labelKey: 'sync__mode_merge_btn_local_remote' | 'sync__mode_merge_btn_remote_local' | 'sync__mode_overwrite_btn_local_remote' | 'sync__mode_overwrite_btn_remote_local' | 'sync__mode_overwrite'
  descKey: 'sync__mode_local_priority_desc' | 'sync__mode_remote_priority_desc' | 'sync__mode_local_overwrite_desc' | 'sync__mode_remote_overwrite_desc' | 'sync__mode_full_overwrite_desc'
  danger?: boolean
}> = [
  { mode: 'merge_local_remote', labelKey: 'sync__mode_merge_btn_local_remote', descKey: 'sync__mode_local_priority_desc' },
  { mode: 'merge_remote_local', labelKey: 'sync__mode_merge_btn_remote_local', descKey: 'sync__mode_remote_priority_desc' },
  { mode: 'overwrite_local_remote', labelKey: 'sync__mode_overwrite_btn_local_remote', descKey: 'sync__mode_local_overwrite_desc' },
  { mode: 'overwrite_remote_local', labelKey: 'sync__mode_overwrite_btn_remote_local', descKey: 'sync__mode_remote_overwrite_desc' },
  { mode: 'full_overwrite', labelKey: 'sync__mode_overwrite', descKey: 'sync__mode_full_overwrite_desc', danger: true },
]

const SyncModeContent = () => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const [selected, setSelected] = useState<BaseSyncMode | 'full_overwrite'>('merge_local_remote')
  const [remember, setRemember] = useState(true)
  const isList = syncState.type == 'list'
  const title = isList
    ? t('sync__list_mode_title', { name: syncState.serverName })
    : t('sync__dislike_mode_title', { name: syncState.serverName })

  const handleConfirm = () => {
    if (selected === 'full_overwrite') {
      if (!isList) return
      global.app_event.selectSyncMode({ type: 'list', mode: 'overwrite_local_remote_full' })
      return
    }
    if (isList) {
      global.app_event.selectSyncMode({ type: 'list', mode: selected })
    } else {
      global.app_event.selectSyncMode({ type: 'dislike', mode: selected })
    }
  }

  const handleCancel = () => {
    if (isList) global.app_event.selectSyncMode({ type: 'list', mode: 'cancel' })
    else global.app_event.selectSyncMode({ type: 'dislike', mode: 'cancel' })
  }

  const visibleOptions = isList ? modeOptions : modeOptions.filter(o => o.mode !== 'full_overwrite')

  return (
    <View style={[styles.overlay, { backgroundColor: r.paper }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.eyebrow}>{t('sync_mode_eyebrow')}</Text>
        <Text size={magType.h2.size} color={r.display} style={styles.title}>{title}</Text>
        <Text size={15} color={r.muted} style={styles.subtitle}>{t('sync__mode_select_subtitle')}</Text>
        <Rule compact gapTop={22} />

        {visibleOptions.map((option, index) => {
          const on = selected === option.mode
          return (
            <View key={option.mode}>
              <TouchableOpacity
                style={styles.option}
                activeOpacity={0.75}
                onPress={() => { setSelected(option.mode) }}
              >
                <View style={styles.optionText}>
                  <Text
                    size={16}
                    color={option.danger ? r.danger : (on ? r.ink : r.option)}
                    style={on ? styles.optionTitleOn : styles.optionTitle}
                  >{t(option.labelKey)}</Text>
                  <Text size={12} color={r.muted} style={styles.optionDesc}>{t(option.descKey)}</Text>
                </View>
                {on
                  ? (
                    <View style={[
                      styles.dot,
                      { backgroundColor: r.accent, borderColor: r.ink },
                    ]} />
                    )
                  : null}
              </TouchableOpacity>
              {index < visibleOptions.length - 1 ? <Hairline /> : null}
            </View>
          )
        })}

        <TouchableOpacity
          style={styles.rememberRow}
          activeOpacity={0.75}
          onPress={() => { setRemember(v => !v) }}
          disabled={!selected.startsWith('merge_')}
        >
          <Checkbox
            checked={remember && selected.startsWith('merge_')}
            onChange={setRemember}
            disabled={!selected.startsWith('merge_')}
          />
          <Text size={14} color={selected.startsWith('merge_') ? r.ink : r.faint} style={styles.rememberLabel}>
            {t('sync_mode_remember')}
          </Text>
        </TouchableOpacity>

        <View style={styles.note}>
          <MdiIcon name="information-outline" size={16} color={r.quiet} />
          <Text size={12} color={r.muted} style={styles.noteText}>{t('sync__mode_remember_merge_only_tip')}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <SecondaryButton label={t('sync__mode_overwrite_btn_cancel')} onPress={handleCancel} style={styles.footerBtn} />
        <PrimaryButton label={t('sync_mode_start')} onPress={handleConfirm} style={styles.footerBtn} />
      </View>
    </View>
  )
}

export default ({ componentId }: { componentId: string }) => {
  useEffect(() => {
    setSyncModeComponentId(componentId)
  }, [componentId])

  return <SyncModeContent />
}

const useStyles = sharedLuxStyles(() => createStyle({
  overlay: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PAGE_GUTTER,
    paddingTop: 48,
    paddingBottom: 20,
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 8,
  },
  subtitle: {
    marginTop: 8,
    lineHeight: 22,
  },
  option: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  optionText: {
    flex: 1,
    minWidth: 0,
  },
  optionTitle: {
    fontWeight: '600',
  },
  optionTitleOn: {
    fontWeight: '800',
  },
  optionDesc: {
    marginTop: 4,
    lineHeight: 17,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    minHeight: 44,
  },
  rememberLabel: {
    fontWeight: '700',
  },
  note: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 14,
  },
  noteText: {
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: PAGE_GUTTER,
    paddingBottom: 28,
    paddingTop: 12,
  },
  footerBtn: {
    flex: 1,
  },
}))
