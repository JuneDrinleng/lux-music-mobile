/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useEffect } from 'react'
import { BackHandler, View } from 'react-native'
import { Navigation } from 'react-native-navigation'

import { MagDialog, TextButton } from '@/components/magazine'
import { useSettingValue } from '@/store/setting/hook'
import { exitApp } from '@/utils/nativeModules/utils'
import { updateSetting } from '@/core/common'
import { checkUpdate } from '@/core/version'
import { initDeeplink } from '@/core/init/deeplink'
import { showAgreementModal } from '@/navigation'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'

const PactModal = ({ componentId }: { componentId: string }) => {
  const t = useI18n()
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

  const openAgreement = () => {
    void Navigation.dismissOverlay(componentId)
    showAgreementModal()
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
    <View style={styles.fill}>
      <MagDialog
        visible
        embedded
        bgHide={false}
        onClose={isAgreePact ? handleClose : handleReject}
        eyebrow={t('pact_modal_eyebrow')}
        title={t('agreement_pact_title')}
        message={isAgreePact ? t('pact_modal_already_message') : t('pact_modal_update_message')}
        cancelLabel={isAgreePact ? t('close') : t('pact_modal_disagree')}
        confirmLabel={isAgreePact ? undefined : t('pact_modal_agree')}
        onCancel={isAgreePact ? handleClose : handleReject}
        onConfirm={handleAccept}
      >
        <TextButton label={t('pact_modal_view_full')} onPress={openAgreement} />
      </MagDialog>
    </View>
  )
}

const styles = createStyle({
  fill: {
    flex: 1,
  },
})

export default PactModal
