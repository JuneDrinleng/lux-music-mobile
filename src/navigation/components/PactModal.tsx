import { useEffect } from 'react'
import { BackHandler, View } from 'react-native'
import { Navigation } from 'react-native-navigation'

import Button from '@/components/common/Button'
import { createStyle, openUrl, tipDialog } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import Text from '@/components/common/Text'
import { exitApp } from '@/utils/nativeModules/utils'
import { updateSetting } from '@/core/common'
import { checkUpdate } from '@/core/version'
import { initDeeplink } from '@/core/init/deeplink'

const PACT_URL = 'https://github.com/lyswhut/lx-music-mobile#%E9%A1%B9%E7%9B%AE%E5%8D%8F%E8%AE%AE'

const PactModal = ({ componentId }: { componentId: string }) => {
  const isAgreePact = useSettingValue('common.isAgreePact')

  const handleReject = () => {
    exitApp()
  }

  const handleAccept = () => {
    const wasAgreed = isAgreePact
    if (!wasAgreed) updateSetting({ 'common.isAgreePact': true })
    void Navigation.dismissOverlay(componentId)

    if (!wasAgreed) {
      void tipDialog({
        title: '',
        message: Buffer.from('e69cace8bdafe4bbb6e5ae8ce585a8e5858de8b4b9e4b894e5bc80e6ba90efbc8ce5a682e69e9ce4bda0e698afe88ab1e992b1e8b4ade4b9b0e79a84efbc8ce8afb7e79bb4e68ea5e7bb99e5b7aee8af84efbc810a0a5468697320736f667477617265206973206672656520616e64206f70656e20736f757263652e', 'hex').toString(),
        btnText: Buffer.from('e5a5bde79a8420284f4b29', 'hex').toString(),
        bgClose: false,
      }).then(() => {
        void checkUpdate()
        void initDeeplink()
      })
    }
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

          <Button style={[styles.btn, styles.btnGhost]} onPress={() => { void openUrl(PACT_URL) }}>
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
