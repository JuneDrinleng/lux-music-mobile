/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Keyboard } from 'react-native'
import { MagDialog, UnderlineInput } from '@/components/magazine'
import { useI18n } from '@/lang'

export interface PromptDialogProps {
  title?: string
  message?: string
  eyebrow?: string
  eyebrowDanger?: boolean
  placeholder?: string
  confirmText?: string
  cancelText?: string
  extraText?: string
  showInput?: boolean
  showConfirm?: boolean
  bgHide?: boolean
  trimValue?: boolean
  autoFocusDelay?: number
  confirmDanger?: boolean
  error?: string
  onCancel?: () => void
  onHide?: () => void
  onConfirm: (value: string) => boolean | undefined | Promise<boolean | undefined>
  onExtra?: (value: string) => boolean | undefined | Promise<boolean | undefined>
}

export interface PromptDialogType {
  show: (value?: string) => void
  hide: () => void
  setValue: (value: string) => void
}

export default forwardRef<PromptDialogType, PromptDialogProps>(({
  title = '',
  message = '',
  eyebrow,
  eyebrowDanger = false,
  placeholder = '',
  confirmText = '',
  cancelText = '',
  showInput = true,
  showConfirm = true,
  extraText = '',
  bgHide = true,
  trimValue = true,
  autoFocusDelay = 250,
  confirmDanger = false,
  error,
  onCancel,
  onHide,
  onConfirm,
  onExtra,
}, ref) => {
  const t = useI18n()
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [text, setText] = useState('')
  const [visible, setVisible] = useState(false)
  const [inputKey, setInputKey] = useState(0)

  const hide = useCallback(() => {
    if (focusTimer.current) {
      clearTimeout(focusTimer.current)
      focusTimer.current = null
    }
    setVisible(false)
    setText('')
    Keyboard.dismiss()
    onHide?.()
  }, [onHide])

  const show = useCallback((value = '') => {
    setText(value)
    setVisible(true)
    setInputKey(k => k + 1)
    if (!showInput) return
    if (focusTimer.current) clearTimeout(focusTimer.current)
    focusTimer.current = setTimeout(() => {
      // UnderlineInput auto-focuses via key remount + autoFocus below
    }, autoFocusDelay)
  }, [autoFocusDelay, showInput])

  useImperativeHandle(ref, () => ({
    show,
    hide,
    setValue(value) {
      setText(value)
    },
  }), [hide, show])

  const handleConfirm = useCallback(async() => {
    const value = trimValue ? text.trim() : text
    const result = await onConfirm(value)
    if (result === false) return
    hide()
  }, [hide, onConfirm, text, trimValue])

  const handleCancel = useCallback(() => {
    onCancel?.()
    hide()
  }, [hide, onCancel])

  const handleExtra = useCallback(async() => {
    if (!onExtra) return
    const value = trimValue ? text.trim() : text
    const result = await onExtra(value)
    if (result === false) return
    hide()
  }, [hide, onExtra, text, trimValue])

  return (
    <MagDialog
      visible={visible}
      onClose={handleCancel}
      eyebrow={eyebrow}
      eyebrowDanger={eyebrowDanger}
      title={title}
      message={message}
      cancelLabel={cancelText || t('cancel')}
      confirmLabel={showConfirm ? (confirmText || t('confirm')) : undefined}
      extraLabel={extraText || undefined}
      onCancel={handleCancel}
      onConfirm={() => { void handleConfirm() }}
      onExtra={extraText ? () => { void handleExtra() } : undefined}
      confirmDanger={confirmDanger}
      bgHide={bgHide}
    >
      {showInput
        ? (
          <UnderlineInput
            key={inputKey}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            error={error}
            autoFocus
            onSubmitEditing={() => { void handleConfirm() }}
            large
          />
          )
        : null}
    </MagDialog>
  )
})
