/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { View, TouchableOpacity } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { useVersionInfo } from '@/store/version/hook'
import { downloadUpdate, hideModal, setIgnoreVersion } from '@/core/version'

const currentVer = process.versions.app
const VersionModal = ({ componentId }: { componentId: string }) => {
  const t = useI18n()
  const versionInfo = useVersionInfo()

  const handleIgnore = () => {
    if (!versionInfo.newVersion) return
    setIgnoreVersion(versionInfo.newVersion.version)
    hideModal(componentId)
  }

  const handleConfirm = () => {
    if (!versionInfo.newVersion) return
    hideModal(componentId)
    downloadUpdate()
  }

  const nextVersion = versionInfo.newVersion?.version ?? '-'

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalCard}>
        <View style={styles.contentBox}>
          <Text style={styles.label} color="#111827">{t('version_label_current_ver')}{currentVer}</Text>
          <Text style={styles.label} color="#111827">{t('version_label_latest_ver')}{nextVersion}</Text>
        </View>
        <View style={styles.modalActions}>
          <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={handleIgnore} activeOpacity={0.75}>
            <Text size={14} color="#4b5563">{t('version_btn_ignore')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleConfirm} activeOpacity={0.85}>
            <Text size={14} color="#111827" style={styles.modalBtnPrimaryText}>{t('version_btn_new')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
}

const styles = createStyle({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eef0f3',
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  contentBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eef0f3',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  modalActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  modalBtn: {
    flexGrow: 1,
    flexShrink: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBtnGhost: {
    backgroundColor: '#f3f4f6',
  },
  modalBtnPrimary: {
    backgroundColor: '#e5e7eb',
  },
  modalBtnPrimaryText: {
    fontWeight: '600',
  },
})

export default VersionModal

