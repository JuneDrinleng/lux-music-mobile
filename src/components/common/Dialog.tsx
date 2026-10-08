/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useImperativeHandle, forwardRef, useMemo, useRef } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Modal, { type ModalType } from './Modal'
import { Icon } from '@/components/common/Icon'
import { useKeyboard } from '@/utils/hooks'
import { createStyle } from '@/utils/tools'
import Text from './Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'

const HEADER_HEIGHT = 42
const useLuxStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '100%',
    maxWidth: 360,
    minWidth: '70%',
    maxHeight: '78%',
    borderRadius: 18,
    backgroundColor: colors.surface.card,
    borderWidth: 1,
    borderColor: colors.line.prompt,
    shadowColor: colors.shadow.dialog,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
    overflow: 'hidden',
  },
  header: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: HEADER_HEIGHT,
    borderBottomWidth: 1,
    borderBottomColor: colors.line.prompt,
    paddingLeft: 14,
    paddingRight: 40,
  },
  title: {
    fontWeight: '700',
    width: '100%',
  },
  closeBtn: {
    position: 'absolute',
    right: 8,
    top: 7,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface.neutral,
  },
})))

export interface DialogProps {
  onHide?: () => void
  keyHide?: boolean
  bgHide?: boolean
  closeBtn?: boolean
  title?: string
  children: React.ReactNode | React.ReactNode[]
  height?: number | `${number}%`
}

export interface DialogType {
  setVisible: (visible: boolean) => void
}

export default forwardRef<DialogType, DialogProps>(({
  onHide,
  keyHide = true,
  bgHide = true,
  closeBtn = true,
  title = '',
  children,
  height,
}: DialogProps, ref) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()

  const { keyboardShown, keyboardHeight } = useKeyboard()
  const modalRef = useRef<ModalType>(null)

  useImperativeHandle(ref, () => ({
    setVisible(visible: boolean) {
      modalRef.current?.setVisible(visible)
    },
  }))

  const closeBtnComponent = useMemo(() => {
    return closeBtn
      ? (
          <TouchableOpacity
            style={styles.closeBtn}
            activeOpacity={0.8}
            onPress={() => { modalRef.current?.setVisible(false) }}
          >
            <Icon name="close" color={colors.ink.meta} size={12} />
          </TouchableOpacity>
        )
      : null
  }, [closeBtn, colors])

  return (
    <Modal onHide={onHide} keyHide={keyHide} bgHide={bgHide} bgColor={colors.scrim.dialog} ref={modalRef}>
      <View style={{ ...styles.centeredView, paddingBottom: keyboardShown ? keyboardHeight : 0, paddingHorizontal: 24 }}>
        <View style={{ ...styles.modalView, height }} onStartShouldSetResponder={() => true}>
          <View style={styles.header}>
            <Text style={styles.title} size={15} color={colors.ink.strong} numberOfLines={1}>{title}</Text>
            {closeBtnComponent}
          </View>
          {children}
        </View>
      </View>
    </Modal>
  )
})
