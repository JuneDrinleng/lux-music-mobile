import { type ReactNode } from 'react'
import { Modal, TouchableOpacity, View, type ViewStyle } from 'react-native'
import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'

const styles = createStyle({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.32)',
  },
  sheet: {
    maxHeight: '72%',
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: '#e7ebf2',
    overflow: 'hidden',
    shadowColor: '#111827',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  handle: {
    width: 34,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d7dce5',
  },
  header: {
    minHeight: 50,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  headerAction: {
    minWidth: 48,
    minHeight: 32,
    justifyContent: 'center',
  },
  headerActionRight: {
    alignItems: 'flex-end',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  headerTitle: {
    fontWeight: '700',
  },
  body: {
    flexShrink: 1,
    minHeight: 120,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
})

export interface BottomSheetModalProps {
  visible: boolean
  title: string
  onClose: () => void
  onConfirm?: () => void
  confirmText?: string
  confirmDisabled?: boolean
  closeDisabled?: boolean
  bottomInset?: number
  sheetStyle?: ViewStyle
  bodyStyle?: ViewStyle
  children?: ReactNode
}

export default ({
  visible,
  title,
  onClose,
  onConfirm,
  confirmText,
  confirmDisabled = false,
  closeDisabled = false,
  bottomInset = 0,
  sheetStyle,
  bodyStyle,
  children,
}: BottomSheetModalProps) => {
  const t = useI18n()

  const handleClose = () => {
    if (closeDisabled) return
    onClose()
  }

  return (
    <Modal
      transparent={true}
      animationType="slide"
      statusBarTranslucent={true}
      presentationStyle="overFullScreen"
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.root}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(bottomInset, 0) }, sheetStyle]}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerAction} activeOpacity={0.8} onPress={handleClose} disabled={closeDisabled}>
              <Text size={13} color={closeDisabled ? '#9ca3af' : '#6b7280'}>{t('cancel')}</Text>
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text size={15} color="#111827" numberOfLines={1} style={styles.headerTitle}>{title}</Text>
            </View>
            <TouchableOpacity
              style={[styles.headerAction, styles.headerActionRight]}
              activeOpacity={0.8}
              onPress={onConfirm}
              disabled={confirmDisabled || !onConfirm}
            >
              {confirmText
                ? <Text size={13} color={confirmDisabled || !onConfirm ? '#9ca3af' : '#111827'}>{confirmText}</Text>
                : null}
            </TouchableOpacity>
          </View>
          <View style={[styles.body, bodyStyle]}>
            {children}
          </View>
        </View>
      </View>
    </Modal>
  )
}
