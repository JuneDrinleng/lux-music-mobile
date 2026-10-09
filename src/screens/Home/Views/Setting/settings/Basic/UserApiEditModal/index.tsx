/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import Text from '@/components/common/Text'
import { View, ScrollView } from 'react-native'
import { createStyle, openUrl, tipDialog } from '@/utils/tools'
import { useI18n } from '@/lang'
import { MagDialog, PrimaryButton, SecondaryButton, TextButton } from '@/components/magazine'
import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import List from './List'
import ScriptImportExport, { type ScriptImportExportType } from './ScriptImportExport'
import ScriptImportOnline, { type ScriptImportOnlineType } from './ScriptImportOnline'
import { state } from '@/store/userApi'

export interface UserApiEditModalType {
  show: () => void
}

export default forwardRef<UserApiEditModalType, {}>((props, ref) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const scriptImportExportRef = useRef<ScriptImportExportType>(null)
  const scriptImportOnlineRef = useRef<ScriptImportOnlineType>(null)

  useImperativeHandle(ref, () => ({
    show() {
      setVisible(true)
    },
  }))

  const handleCancel = () => {
    setVisible(false)
  }

  const openFAQPage = () => {
    void openUrl('https://lyswhut.github.io/lx-music-doc/mobile/custom-source')
  }

  const handleLocalImport = () => {
    if (state.list.length > 20) {
      void tipDialog({
        message: t('user_api_max_tip'),
        btnText: t('ok'),
      })
      return
    }
    scriptImportExportRef.current?.import()
  }

  const handleOnlineImport = () => {
    if (state.list.length > 20) {
      void tipDialog({
        message: t('user_api_max_tip'),
        btnText: t('ok'),
      })
      return
    }
    scriptImportOnlineRef.current?.show()
  }

  return (
    <>
      <MagDialog
        visible={visible}
        onClose={handleCancel}
        bgHide={false}
        eyebrow={t('user_api_eyebrow')}
        title={t('user_api_title')}
        message={t('user_api_manage_desc')}
      >
        <ScrollView style={styles.list} keyboardShouldPersistTaps="always">
          <List />
        </ScrollView>
        <View style={styles.actions}>
          <PrimaryButton
            label={t('user_api_btn_import_local')}
            icon="file-download-outline"
            onPress={handleLocalImport}
            style={styles.actionBtn}
          />
          <SecondaryButton
            label={t('user_api_btn_import_online')}
            icon="link-variant"
            onPress={handleOnlineImport}
            style={styles.actionBtn}
          />
        </View>
        <View style={styles.tips}>
          <Text size={12} color={r.muted}>{t('user_api_readme')}</Text>
          <TextButton label="github.com/lyswhut/lx-music-source" onPress={openFAQPage} />
          <View style={styles.warning}>
            <MdiIcon name="alert-outline" size={14} color={r.quiet} />
            <Text size={12} color={r.muted} style={styles.warningText}>{t('user_api_note')}</Text>
          </View>
          <TextButton label={t('close')} onPress={handleCancel} muted />
        </View>
      </MagDialog>
      <ScriptImportExport ref={scriptImportExportRef} />
      <ScriptImportOnline ref={scriptImportOnlineRef} />
    </>
  )
})

const useStyles = sharedLuxStyles(() => createStyle({
  list: {
    maxHeight: 260,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
  },
  tips: {
    marginTop: 16,
    gap: 8,
  },
  warning: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 4,
  },
  warningText: {
    flex: 1,
    lineHeight: 18,
  },
}))
