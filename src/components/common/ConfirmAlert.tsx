/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { forwardRef, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'
import { MagDialog } from '@/components/magazine'
import { useI18n } from '@/lang/index'
import Text from './Text'

export interface ConfirmAlertProps {
  onCancel?: () => void
  onHide?: () => void
  onConfirm?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  text?: string
  eyebrow?: string
  cancelText?: string
  confirmText?: string
  showConfirm?: boolean
  disabledConfirm?: boolean
  reverseBtn?: boolean
  confirmDanger?: boolean
  children?: React.ReactNode | React.ReactNode[]
}

export interface ConfirmAlertType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<ConfirmAlertType, ConfirmAlertProps>(({
  onHide,
  onCancel,
  onConfirm = () => {},
  bgHide,
  title = '',
  text = '',
  eyebrow,
  cancelText = '',
  confirmText = '',
  showConfirm = true,
  disabledConfirm = false,
  confirmDanger = false,
  children,
}: ConfirmAlertProps, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)

  useImperativeHandle(ref, () => ({
    setVisible(next) {
      setVisible(next)
      if (!next) onHide?.()
    },
  }))

  const handleCancel = () => {
    onCancel?.()
    setVisible(false)
    onHide?.()
  }

  const handleConfirm = () => {
    onConfirm()
  }

  return (
    <MagDialog
      visible={visible}
      onClose={handleCancel}
      eyebrow={eyebrow}
      title={title || (children ? '' : t('confirm'))}
      message={children ? undefined : text}
      cancelLabel={cancelText || t('cancel')}
      confirmLabel={showConfirm ? (confirmText || t('confirm')) : undefined}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      confirmDisabled={disabledConfirm}
      confirmDanger={confirmDanger}
      bgHide={bgHide ?? true}
    >
      {children
        ? (
          <View>
            {typeof children === 'string' || typeof children === 'number'
              ? <Text>{children}</Text>
              : children}
          </View>
          )
        : null}
    </MagDialog>
  )
})
