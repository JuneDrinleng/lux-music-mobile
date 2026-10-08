/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react'
import { Keyboard, Modal, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native'
import Input, { type InputType } from './Input'
import Text from './Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'

export interface PromptDialogProps {
  title?: string
  message?: string
  placeholder?: string
  confirmText?: string
  cancelText?: string
  showInput?: boolean
  showConfirm?: boolean
  extraText?: string
  bgHide?: boolean
  trimValue?: boolean
  autoFocusDelay?: number
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
  placeholder = '',
  confirmText = '',
  cancelText = '',
  showInput = true,
  showConfirm = true,
  extraText = '',
  bgHide = true,
  trimValue = true,
  autoFocusDelay = 250,
  onCancel,
  onHide,
  onConfirm,
  onExtra,
}, ref) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()

  const t = useI18n()
  const theme = useTheme()
  const inputRef = useRef<InputType>(null)
  const [text, setText] = useState('')
  const [visible, setVisible] = useState(false)

  const hide = useCallback(() => {
    setVisible(false)
    setText('')
    onHide?.()
  }, [onHide])

  const show = useCallback((value = '') => {
    setText(value)
    setVisible(true)
    if (!showInput) return
    requestAnimationFrame(() => {
      setTimeout(() => {
        inputRef.current?.focus()
      }, autoFocusDelay)
    })
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
  const handleRequestClose = useCallback(() => {
    hide()
  }, [hide])
  const handleOverlayPress = useCallback(() => {
    if (bgHide) hide()
    else Keyboard.dismiss()
  }, [bgHide, hide])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <TouchableWithoutFeedback onPress={handleOverlayPress}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalCard}>
              {title ? <Text size={17} color={colors.ink.strong} style={styles.title}>{title}</Text> : null}
              {message ? <Text size={13} color={colors.ink.meta} style={styles.message}>{message}</Text> : null}
              {showInput
                ? <Input
                    ref={inputRef}
                    placeholder={placeholder}
                    value={text}
                    onChangeText={setText}
                    onSubmitEditing={() => { void handleConfirm() }}
                    style={[styles.input, { backgroundColor: theme['c-primary-background'] }]}
                  />
                : null}
              <View style={[styles.modalActions, showInput ? null : styles.modalActionsNoInput]}>
                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={handleCancel} activeOpacity={0.75}>
                  <Text size={14} color={colors.ink.cancel}>{cancelText || t('cancel')}</Text>
                </TouchableOpacity>
                {extraText
                  ? <TouchableOpacity style={[styles.modalBtn, styles.modalBtnGhost]} onPress={() => { void handleExtra() }} activeOpacity={0.75}>
                      <Text size={14} color={colors.ink.cancel}>{extraText}</Text>
                    </TouchableOpacity>
                  : null}
                {showConfirm
                  ? <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={() => { void handleConfirm() }} activeOpacity={0.85}>
                      <Text size={14} color={colors.ink.strong} style={styles.modalBtnPrimaryText}>{confirmText || t('confirm')}</Text>
                    </TouchableOpacity>
                  : null}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  )
})

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.scrim.dialog,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 18,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.line.prompt,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  title: {
    fontWeight: '700',
    marginBottom: 6,
  },
  message: {
    marginBottom: 2,
    lineHeight: 18,
  },
  input: {
    borderRadius: 12,
    height: 44,
  },
  modalActions: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 10,
  },
  modalActionsNoInput: {
    marginTop: 12,
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
    backgroundColor: colors.surface.neutral,
  },
  modalBtnPrimary: {
    backgroundColor: colors.line.neutral,
  },
  modalBtnPrimaryText: {
    fontWeight: '600',
  },
})))
