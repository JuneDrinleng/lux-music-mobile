/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { forwardRef, useImperativeHandle, useRef } from 'react'
import { View, ScrollView } from 'react-native'
import Dialog, { type DialogType } from './Dialog'
import Button from './Button'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang/index'
import Text from './Text'

const styles = createStyle({
  main: {
    flexShrink: 1,
    marginTop: 12,
    marginLeft: 12,
    marginRight: 12,
    marginBottom: 10,
  },
  content: {
    flexGrow: 0,
    paddingLeft: 4,
    paddingRight: 4,
  },
  btns: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingBottom: 14,
  },
  btnsDirection: {
    paddingHorizontal: 12,
  },
  btnsReversedDirection: {
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
  },
  btn: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  btnDirection: {
    marginRight: 10,
  },
  btnReversedDirection: {
    marginLeft: 10,
  },
})

export interface ConfirmAlertProps {
  onCancel?: () => void
  onHide?: () => void
  onConfirm?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  text?: string
  cancelText?: string
  confirmText?: string
  showConfirm?: boolean
  disabledConfirm?: boolean
  reverseBtn?: boolean
  children?: React.ReactNode | React.ReactNode[]
}

export interface ConfirmAlertType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<ConfirmAlertType, ConfirmAlertProps>(({
  onHide,
  onCancel,
  onConfirm = () => {},
  keyHide,
  bgHide,
  closeBtn,
  title = '',
  text = '',
  cancelText = '',
  confirmText = '',
  showConfirm = true,
  disabledConfirm = false,
  children,
  reverseBtn = false,
}: ConfirmAlertProps, ref) => {
  const t = useI18n()

  const dialogRef = useRef<DialogType>(null)

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
      dialogRef.current?.setVisible(visible)
    },
  }))

  const handleCancel = () => {
    onCancel?.()
    dialogRef.current?.setVisible(false)
  }

  return (
    <Dialog onHide={onHide} keyHide={keyHide} bgHide={bgHide} closeBtn={closeBtn} title={title} ref={dialogRef}>
      <View style={styles.main}>
        <ScrollView style={styles.content} keyboardShouldPersistTaps={'always'}>
          {children ?? <Text>{text}</Text>}
        </ScrollView>
      </View>
      <View style={{ ...styles.btns, ...(reverseBtn ? styles.btnsReversedDirection : styles.btnsDirection) }}>
        <Button style={{ ...styles.btn, ...(reverseBtn ? styles.btnReversedDirection : styles.btnDirection), backgroundColor: '#f3f4f6' }} onPress={handleCancel}>
          <Text color="#4b5563">{cancelText || t('cancel')}</Text>
        </Button>
        {showConfirm
          ? <Button style={{ ...styles.btn, ...(reverseBtn ? styles.btnReversedDirection : styles.btnDirection), backgroundColor: '#e5e7eb' }} onPress={onConfirm} disabled={disabledConfirm}>
              <Text color="#111827">{confirmText || t('confirm')}</Text>
            </Button>
          : null}
      </View>
    </Dialog>
  )
})
