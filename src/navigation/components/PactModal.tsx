/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useEffect } from 'react'
import { BackHandler, View } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import { createStyle } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import Text from '@/components/common/Text'
import { exitApp } from '@/utils/nativeModules/utils'
import { updateSetting } from '@/core/common'
import { checkUpdate } from '@/core/version'
import { initDeeplink } from '@/core/init/deeplink'
import { showAgreementModal } from '@/navigation'

const PactModal = ({ componentId }: { componentId: string }) => {
  const isAgreePact = useSettingValue('common.isAgreePact')

  const handleReject = () => {
    exitApp()
  }

  const handleAccept = () => {
    const wasAgreed = isAgreePact
    if (!wasAgreed) {
      updateSetting({ 'common.isAgreePact': true })
      void checkUpdate()
      void initDeeplink()
    }
    void Navigation.dismissOverlay(componentId)
  }

  const handleClose = () => {
    void Navigation.dismissOverlay(componentId)
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isAgreePact) {
        exitApp()
        return true
      }
      void Navigation.dismissOverlay(componentId)
      return true
    })
    return () => {
      subscription.remove()
    }
  }, [isAgreePact, componentId])

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text size={17} color="#111827" style={styles.title}>许可协议</Text>
        <Text size={13} color="#6b7280" style={styles.message}>
          {isAgreePact
            ? '你已签署许可协议，可点击“许可协议”查看完整页面。'
            : '继续使用前请先阅读并接受许可协议。'}
        </Text>
        <View style={styles.actions}>
          {isAgreePact
            ? (
                <Button style={[styles.btn, styles.btnGhost]} onPress={handleClose}>
                  <Text color="#4b5563">关闭</Text>
                </Button>
              )
            : (
                <Button style={[styles.btn, styles.btnGhost]} onPress={handleReject}>
                  <Text color="#4b5563">不接受</Text>
                </Button>
              )}

          <Button style={[styles.btn, styles.btnGhost]} onPress={() => { void Navigation.dismissOverlay(componentId); showAgreementModal() }}>
            <Text color="#4b5563">许可协议</Text>
          </Button>

          {!isAgreePact
            ? (
                <Button style={[styles.btn, styles.btnPrimary]} onPress={handleAccept}>
                  <Text color="#111827">接受</Text>
                </Button>
              )
            : null}
        </View>
      </View>
    </View>
  )
}

const styles = createStyle({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.22)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eef0f3',
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  title: {
    fontWeight: '700',
    marginBottom: 8,
  },
  message: {
    lineHeight: 19,
  },
  actions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  btn: {
    flexGrow: 1,
    flexShrink: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhost: {
    backgroundColor: '#f3f4f6',
  },
  btnPrimary: {
    backgroundColor: '#e5e7eb',
  },
})

export default PactModal
