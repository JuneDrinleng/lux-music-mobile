/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { Modal, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

import { PrimaryButton } from './PrimaryButton'
import { SecondaryButton } from './SecondaryButton'

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    root: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: PAGE_GUTTER,
      backgroundColor: r.scrim,
    },
    card: {
      backgroundColor: r.paper,
      borderRadius: 8,
      overflow: 'hidden',
      paddingHorizontal: 22,
      paddingTop: 0,
      paddingBottom: 18,
    },
    inkBar: {
      height: 3,
      backgroundColor: r.ink,
      marginHorizontal: -22,
      marginBottom: 18,
    },
    eyebrow: {
      fontWeight: '700',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    title: {
      fontWeight: '800',
      marginTop: 6,
    },
    message: {
      marginTop: 8,
      lineHeight: 21,
    },
    body: {
      marginTop: 14,
    },
    actions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 18,
    },
    actionHalf: {
      flex: 1,
    },
  })
})

export const MagDialog = memo(({
  visible,
  onClose,
  eyebrow,
  title,
  message,
  children,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  confirmDisabled = false,
  confirmDanger = false,
  bgHide = true,
}: {
  visible: boolean
  onClose: () => void
  eyebrow?: string
  title: string
  message?: string
  children?: ReactNode
  cancelLabel?: string
  confirmLabel?: string
  onCancel?: () => void
  onConfirm?: () => void
  confirmDisabled?: boolean
  confirmDanger?: boolean
  bgHide?: boolean
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  if (!visible) return null
  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity
        style={styles.root}
        activeOpacity={1}
        onPress={bgHide ? onClose : undefined}
      >
        <TouchableOpacity activeOpacity={1} onPress={() => {}}>
          <View style={styles.card}>
            <View style={styles.inkBar} />
            {eyebrow
              ? <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.eyebrow}>{eyebrow}</Text>
              : null}
            <Text size={magType.dialogTitle.size} color={r.display} style={styles.title}>{title}</Text>
            {message
              ? <Text size={14} color={r.muted} style={styles.message}>{message}</Text>
              : null}
            {children ? <View style={styles.body}>{children}</View> : null}
            {(cancelLabel || confirmLabel)
              ? (
                <View style={styles.actions}>
                  {cancelLabel
                    ? (
                      <SecondaryButton
                        label={cancelLabel}
                        onPress={onCancel ?? onClose}
                        style={styles.actionHalf}
                      />
                      )
                    : null}
                  {confirmLabel
                    ? (
                      <PrimaryButton
                        label={confirmLabel}
                        onPress={onConfirm}
                        disabled={confirmDisabled}
                        danger={confirmDanger}
                        style={styles.actionHalf}
                      />
                      )
                    : null}
                </View>
                )
              : null}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
})
