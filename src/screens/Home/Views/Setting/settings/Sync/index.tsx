import { memo, useCallback, useImperativeHandle, useState, forwardRef } from 'react'

import { Keyboard, Modal, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native'

import Section from '../../components/Section'
import IsEnable from './IsEnable'
import History from './History'
import { useI18n } from '@/lang'
import { createStyle, toast } from '@/utils/tools'
import Input from '@/components/common/Input'
import Text from '@/components/common/Text'
import { useTheme } from '@/store/theme/hook'
import { setSyncHost } from '@/utils/data'
import { connectServer } from '@/plugins/sync'
import { useSettingValue } from '@/store/setting/hook'
// import SyncHost from './SyncHost'

const hostAddressRxp = /^https?:\/\/\S+/i

interface Props {
  embedded?: boolean
}

export interface SyncType {
  showHostInput: () => void
}

const SyncComp = forwardRef<SyncType, Props>(({ embedded = false }: Props, ref) => {
  const t = useI18n()
  const theme = useTheme()
  const isEnableSync = useSettingValue('sync.enable')

  const [host, setHost] = useState('')
  const [hostDraft, setHostDraft] = useState('')
  const [isHostModalVisible, setHostModalVisible] = useState(false)

  const showHostInput = useCallback(() => {
    setHostDraft(host)
    setHostModalVisible(true)
  }, [host])

  useImperativeHandle(ref, () => ({
    showHostInput,
  }), [showHostInput])

  const handleCloseHostModal = useCallback(() => {
    setHostDraft(host)
    setHostModalVisible(false)
  }, [host])

  const handleSaveHost = useCallback(() => {
    const normalizedHost = hostDraft.trim()
    if (!hostAddressRxp.test(normalizedHost)) {
      toast(t('setting_sync_host_value_error_tip'), 'long')
      return
    }

    void setSyncHost(normalizedHost)
    setHost(normalizedHost)

    if (isEnableSync) {
      void connectServer(normalizedHost)
    }

    setHostModalVisible(false)
  }, [hostDraft, isEnableSync, t])

  const content = (
    <>
      <IsEnable host={host} setHost={setHost} compact={embedded} />
      <History setHost={setHost} compact={embedded} />
      <Modal
        visible={isHostModalVisible}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={handleCloseHostModal}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text size={17} color="#111827" style={styles.modalTitle}>{t('setting_sync_host_label')}</Text>
                <Input
                  placeholder={t('setting_sync_host_value_tip')}
                  value={hostDraft}
                  onChangeText={setHostDraft}
                  style={[styles.modalInput, { backgroundColor: theme['c-primary-background'] }]}
                  inputMode="url"
                  autoCapitalize="none"
                />
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={handleCloseHostModal} activeOpacity={0.75}>
                    <Text size={14} color="#4b5563">{'\u53d6\u6d88'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={handleSaveHost} activeOpacity={0.85}>
                    <Text size={14} color="#111827" style={styles.modalBtnPrimaryText}>{'\u4fdd\u5b58'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  )

  if (embedded) {
    return <View style={styles.embeddedContainer}>{content}</View>
  }

  return (
    <Section title={t('setting_sync')}>
      {content}
    </Section>
  )
})

export default memo(SyncComp)

const styles = createStyle({
  embeddedContainer: {
    marginTop: 2,
  },
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
  modalTitle: {
    fontWeight: '700',
    marginBottom: 12,
  },
  modalInput: {
    borderRadius: 12,
    height: 44,
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
