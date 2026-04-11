/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { forwardRef, useImperativeHandle, useRef, useState } from 'react'

import PromptDialog, { type PromptDialogType } from '@/components/common/PromptDialog'

import { toast } from '@/utils/tools'

import { useI18n } from '@/lang'
import { checkDesktopLyricOverlayPermission, hideDesktopLyric, openDesktopLyricOverlayPermissionActivity, showDesktopLyric } from '@/core/desktopLyric'
import { updateSetting } from '@/core/common'

export interface DesktopLyricEnableType {
  setEnabled: (enabled: boolean) => void
}

export default forwardRef<DesktopLyricEnableType, {}>((props, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  // const setIsShowDesktopLyric = useDispatch('common', 'setIsShowDesktopLyric')
  const promptDialogRef = useRef<PromptDialogType>(null)

  useImperativeHandle(ref, () => ({
    setEnabled(enabled) {
      void handleChangeEnableDesktopLyric(enabled)
    },
  }))

  const handleShowModal = () => {
    if (visible) promptDialogRef.current?.show('')
    else {
      setVisible(true)
      requestAnimationFrame(() => {
        promptDialogRef.current?.show('')
      })
    }
  }
  const handleChangeEnableDesktopLyric = async(isEnable: boolean) => {
    if (isEnable) {
      try {
        await checkDesktopLyricOverlayPermission()
        await showDesktopLyric()
      } catch (err) {
        console.log(err)
        handleShowModal()
        // return false
      }
    } else await hideDesktopLyric()
    // return true
    updateSetting({ 'desktopLyric.enable': isEnable })
  }

  const handleTipsCancel = () => {
    updateSetting({ 'desktopLyric.enable': false })
    toast(t('disagree_tip'), 'long')
  }
  const handleTipsConfirm = () => {
    void openDesktopLyricOverlayPermissionActivity()
    return true
  }

  return (
    visible
      ? (
          <PromptDialog
            ref={promptDialogRef}
            title={t('setting_lyric_desktop_permission_tip')}
            showInput={false}
            bgHide={false}
            cancelText={t('disagree')}
            confirmText={t('agree_go')}
            onCancel={handleTipsCancel}
            onConfirm={handleTipsConfirm}
          />
        )
      : null
  )
})
