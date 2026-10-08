import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import CheckBox from '@/components/common/CheckBox'
import { MdiIcon } from '@/components/common/MdiIcon'
import Text from '@/components/common/Text'
import { setSyncModeComponentId } from '@/core/sync'
import { useI18n } from '@/lang'
import syncState from '@/store/sync/state'

type BaseSyncMode = 'merge_local_remote' | 'merge_remote_local' | 'overwrite_local_remote' | 'overwrite_remote_local'

const modeOptions: Array<{
  mode: BaseSyncMode
  labelKey: 'sync__mode_merge_btn_local_remote' | 'sync__mode_merge_btn_remote_local' | 'sync__mode_overwrite_btn_local_remote' | 'sync__mode_overwrite_btn_remote_local'
  tone: 'green' | 'purple' | 'amber' | 'red'
}> = [
  { mode: 'merge_local_remote', labelKey: 'sync__mode_merge_btn_local_remote', tone: 'green' },
  { mode: 'merge_remote_local', labelKey: 'sync__mode_merge_btn_remote_local', tone: 'purple' },
  { mode: 'overwrite_local_remote', labelKey: 'sync__mode_overwrite_btn_local_remote', tone: 'amber' },
  { mode: 'overwrite_remote_local', labelKey: 'sync__mode_overwrite_btn_remote_local', tone: 'red' },
]

const SyncModeContent = () => {
  const t = useI18n()
  const [isFullOverwrite, setFullOverwrite] = useState(false)
  const isList = syncState.type == 'list'
  const title = isList
    ? t('sync__list_mode_title', { name: syncState.serverName })
    : t('sync__dislike_mode_title', { name: syncState.serverName })

  const handleSelectMode = (baseMode: BaseSyncMode) => {
    if (isList) {
      const mode: LX.Sync.List.SyncMode = baseMode.startsWith('overwrite') && isFullOverwrite
        ? `${baseMode}_full` as LX.Sync.List.SyncMode
        : baseMode
      global.app_event.selectSyncMode({ type: 'list', mode })
    } else {
      global.app_event.selectSyncMode({ type: 'dislike', mode: baseMode })
    }
  }

  const handleCancel = () => {
    if (isList) global.app_event.selectSyncMode({ type: 'list', mode: 'cancel' })
    else global.app_event.selectSyncMode({ type: 'dislike', mode: 'cancel' })
  }

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <MdiIcon name="sync" size={25} color="#000000" />
          </View>
          <View style={styles.headerText}>
            <Text size={18} color="#171a22" style={styles.title}>{title}</Text>
            <Text size={13} color="#6b7280" style={styles.subtitle}>{t('sync__mode_select_subtitle')}</Text>
          </View>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.notice}>
            <Text size={12} color="#5f6572" style={styles.noticeText}>{t('sync__mode_remember_merge_only_tip')}</Text>
          </View>

          <Text size={12} color="#8a909c" style={styles.sectionLabel}>{t('sync__mode_merge_tip')}</Text>
          <View style={styles.optionGroup}>
            {modeOptions.slice(0, 2).map((option, index) => (
              <View key={option.mode}>
                <TouchableOpacity style={styles.option} activeOpacity={0.82} onPress={() => { handleSelectMode(option.mode) }}>
                  <View style={[styles.optionDot, styles[`${option.tone}Dot`]]} />
                  <View style={styles.optionTextWrap}>
                    <Text size={14} color="#20242d" style={styles.optionTitle}>{t(option.labelKey)}</Text>
                    <Text size={12} color="#737986" style={styles.optionDesc}>
                      {option.mode == 'merge_local_remote' ? t('sync__mode_local_priority_desc') : t('sync__mode_remote_priority_desc')}
                    </Text>
                  </View>
                  <Text size={20} color="#a0a6b2">›</Text>
                </TouchableOpacity>
                {index == 0 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>

          <Text size={12} color="#8a909c" style={styles.sectionLabel}>{t('sync__mode_overwrite_label')}</Text>
          <View style={styles.optionGroup}>
            {modeOptions.slice(2).map((option, index) => (
              <View key={option.mode}>
                <TouchableOpacity style={styles.option} activeOpacity={0.82} onPress={() => { handleSelectMode(option.mode) }}>
                  <View style={[styles.optionDot, styles[`${option.tone}Dot`]]} />
                  <View style={styles.optionTextWrap}>
                    <Text size={14} color="#20242d" style={styles.optionTitle}>{t(option.labelKey)}</Text>
                    <Text size={12} color="#737986" style={styles.optionDesc}>
                      {option.mode == 'overwrite_local_remote' ? t('sync__mode_local_overwrite_desc') : t('sync__mode_remote_overwrite_desc')}
                    </Text>
                  </View>
                  <Text size={20} color="#a0a6b2">›</Text>
                </TouchableOpacity>
                {index == 0 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>

          {isList
            ? <View style={styles.fullOverwriteRow}>
                <CheckBox check={isFullOverwrite} onChange={setFullOverwrite} label={t('sync__mode_overwrite')} />
                <Text size={11} color="#8a909c" style={styles.fullOverwriteHint}>{t('sync__mode_full_overwrite_desc')}</Text>
              </View>
            : null}

          <View style={styles.helpCard}>
            <Text size={12} color="#5f6572" style={styles.helpText}>
              <Text size={12} color="#353a45" style={styles.helpTitle}>{t('sync__mode_merge_tip')}</Text>
              {isList ? t('sync__list_mode_merge_tip_desc') : t('sync__dislike_mode_merge_tip_desc')}
            </Text>
            <Text size={12} color="#5f6572" style={styles.helpText}>
              <Text size={12} color="#353a45" style={styles.helpTitle}>{t('sync__mode_overwrite_tip')}</Text>
              {isList ? t('sync__list_mode_overwrite_tip_desc') : t('sync__dislike_mode_overwrite_tip_desc')}
            </Text>
          </View>
        </ScrollView>

        <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.78} onPress={handleCancel}>
          <Text size={14} color="#5f6572" style={styles.cancelText}>{t('sync__mode_overwrite_btn_cancel')}</Text>
        </TouchableOpacity>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 28,
    backgroundColor: 'rgba(22,24,31,0.28)',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    overflow: 'hidden',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(238,240,243,0.98)',
    backgroundColor: '#f8f9fc',
    shadowColor: '#20242d',
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eceff4',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ede9fe',
    marginRight: 12,
  },
  icon: {
    width: 25,
    height: 25,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
    lineHeight: 24,
  },
  subtitle: {
    marginTop: 3,
    lineHeight: 18,
  },
  scroll: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 8,
  },
  notice: {
    borderRadius: 12,
    backgroundColor: '#eef2ff',
    borderWidth: 1,
    borderColor: '#e0e7ff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginBottom: 14,
  },
  noticeText: {
    lineHeight: 18,
  },
  sectionLabel: {
    marginLeft: 4,
    marginBottom: 7,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  optionGroup: {
    overflow: 'hidden',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e9ecf2',
    backgroundColor: '#ffffff',
    marginBottom: 14,
  },
  option: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  optionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
  },
  greenDot: { backgroundColor: '#65a30d' },
  purpleDot: { backgroundColor: '#7c3aed' },
  amberDot: { backgroundColor: '#d97706' },
  redDot: { backgroundColor: '#dc2626' },
  optionTextWrap: {
    flex: 1,
    paddingRight: 8,
  },
  optionTitle: {
    fontWeight: '600',
    lineHeight: 20,
  },
  optionDesc: {
    marginTop: 2,
    lineHeight: 17,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#eceff4',
    marginLeft: 35,
  },
  fullOverwriteRow: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#e9ecf2',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  fullOverwriteHint: {
    marginLeft: 34,
    marginTop: 2,
    lineHeight: 16,
  },
  helpCard: {
    borderRadius: 13,
    backgroundColor: '#f0f2f7',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  helpText: {
    lineHeight: 18,
    marginBottom: 7,
  },
  helpTitle: {
    fontWeight: '700',
  },
  cancelBtn: {
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 14,
    borderRadius: 13,
    backgroundColor: '#eceff3',
  },
  cancelText: {
    fontWeight: '600',
  },
})
