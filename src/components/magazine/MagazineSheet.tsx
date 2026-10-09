/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native'

import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

import { EmptyState } from './EmptyState'
import { Hairline } from './Hairline'
import { PrimaryButton } from './PrimaryButton'
import { TextButton } from './TextButton'

const OPEN_MS = 220
const CLOSE_MS = 220
const OPEN_EASING = Easing.out(Easing.cubic)

export interface MagazineSheetFooter {
  meta?: string
  cancel: string
  primary: string
  disabled?: boolean
  count?: number
  onCancel: () => void
  onPrimary: () => void
}

export interface MagazineSheetProps {
  visible: boolean
  onClose: () => void
  heightRatio?: 0.62 | 0.78 | number
  eyebrow?: string
  title: string
  meta?: string
  figure?: { value: string, unit?: string }
  headerAction?: { text: string, tone?: 'ink' | 'danger', disabled?: boolean, onPress: () => void }
  subject?: ReactNode
  sectionLabel?: string
  children?: ReactNode
  footer?: MagazineSheetFooter
  loading?: boolean
  empty?: { text: string, eyebrow?: string }
}

const useStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    root: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    mask: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: r.scrim,
    },
    panel: {
      backgroundColor: r.paper,
      borderTopLeftRadius: 6,
      borderTopRightRadius: 6,
      overflow: 'hidden',
      paddingHorizontal: PAGE_GUTTER,
      paddingTop: 0,
    },
    inkBar: {
      height: 3,
      backgroundColor: r.ink,
      marginHorizontal: -PAGE_GUTTER,
    },
    header: {
      paddingTop: 14,
      paddingBottom: 8,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerText: {
      flex: 1,
      minWidth: 0,
    },
    eyebrow: {
      fontWeight: '700',
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    title: {
      fontWeight: '800',
      marginTop: 4,
    },
    close: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1.5,
      borderColor: r.ink,
      alignItems: 'center',
      justifyContent: 'center',
    },
    figureRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginTop: 10,
      marginBottom: 6,
    },
    figure: {
      fontWeight: '800',
      letterSpacing: -2,
      includeFontPadding: false,
    },
    figureUnit: {
      fontWeight: '600',
      marginLeft: 8,
    },
    toolRule: {
      height: 1,
      backgroundColor: r.ink,
      opacity: 0.9,
      marginTop: 8,
    },
    toolRow: {
      minHeight: 40,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 8,
    },
    toolMeta: {
      fontWeight: '600',
      flex: 1,
    },
    sectionLabel: {
      fontWeight: '700',
      letterSpacing: 2,
      textTransform: 'uppercase',
      marginTop: 10,
      marginBottom: 4,
    },
    body: {
      flexGrow: 1,
      flexShrink: 1,
    },
    footer: {
      paddingTop: 10,
      paddingBottom: 18,
    },
    footerRule: {
      height: 1,
      backgroundColor: r.ink,
      opacity: 0.9,
      marginBottom: 12,
      marginHorizontal: -PAGE_GUTTER,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    countBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      backgroundColor: r.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
    countText: {
      fontWeight: '800',
    },
    primaryWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
  })
})

export const MagazineSheet = memo(({
  visible,
  onClose,
  heightRatio = 0.78,
  eyebrow,
  title,
  meta,
  figure,
  headerAction,
  subject,
  sectionLabel,
  children,
  footer,
  loading = false,
  empty,
}: MagazineSheetProps) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const { height: winH } = useWindowDimensions()
  const panelH = useMemo(() => Math.floor(winH * heightRatio), [winH, heightRatio])
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!visible) return
    anim.setValue(0)
    Animated.timing(anim, {
      toValue: 1,
      duration: OPEN_MS,
      easing: OPEN_EASING,
      useNativeDriver: true,
    }).start()
  }, [visible, anim])

  const requestClose = () => {
    Animated.timing(anim, {
      toValue: 0,
      duration: CLOSE_MS,
      easing: OPEN_EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose()
    })
  }

  if (!visible) return null

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [panelH, 0],
  })
  const maskOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  return (
    <Modal transparent visible animationType="none" onRequestClose={requestClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View style={[styles.mask, { opacity: maskOpacity }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={requestClose} />
        </Animated.View>
        <Animated.View style={[styles.panel, { height: panelH, transform: [{ translateY }] }]}>
          <View style={styles.inkBar} />
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <View style={styles.headerText}>
                {eyebrow
                  ? <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.eyebrow} numberOfLines={1}>{eyebrow}</Text>
                  : null}
                <Text size={magType.sheetTitle.size} color={r.display} style={styles.title} numberOfLines={1}>{title}</Text>
              </View>
              <TouchableOpacity style={styles.close} activeOpacity={0.7} onPress={requestClose} accessibilityRole="button">
                <MdiIcon name="close" size={18} color={r.ink} />
              </TouchableOpacity>
            </View>
            {subject
              ? <View style={{ marginTop: 12 }}>{subject}</View>
              : figure
                ? (
                  <View style={styles.figureRow}>
                    <Text size={magType.sheetFigure.size} color={r.display} style={styles.figure}>{figure.value}</Text>
                    {figure.unit
                      ? <Text size={14} color={r.muted} style={styles.figureUnit}>{figure.unit}</Text>
                      : null}
                  </View>
                  )
                : null}
            <View style={styles.toolRule} />
            <View style={styles.toolRow}>
              <Text size={12} color={r.muted} style={styles.toolMeta} numberOfLines={1}>{meta ?? ' '}</Text>
              {headerAction
                ? (
                  <TextButton
                    label={headerAction.text}
                    danger={headerAction.tone === 'danger'}
                    muted={headerAction.disabled}
                    disabled={headerAction.disabled}
                    onPress={headerAction.onPress}
                  />
                  )
                : null}
            </View>
            <Hairline />
          </View>
          {sectionLabel
            ? <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.sectionLabel}>{sectionLabel}</Text>
            : null}
          <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
            {loading
              ? <EmptyState eyebrow="LOADING" title={empty?.text ?? '…'} />
              : !children && empty
                  ? <EmptyState eyebrow={empty.eyebrow} title={empty.text} />
                  : children}
          </ScrollView>
          {footer
            ? (
              <View style={styles.footer}>
                <View style={styles.footerRule} />
                <View style={styles.footerRow}>
                  <TextButton label={footer.cancel} muted underline={false} onPress={footer.onCancel} />
                  <View style={styles.primaryWrap}>
                    {footer.count != null
                      ? (
                        <View style={styles.countBadge}>
                          <Text size={12} color={r.onAccent} style={styles.countText}>{footer.count}</Text>
                        </View>
                        )
                      : null}
                    <PrimaryButton
                      label={footer.primary}
                      disabled={footer.disabled}
                      onPress={footer.onPrimary}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              </View>
              )
            : <View style={{ height: 12 }} />}
        </Animated.View>
      </View>
    </Modal>
  )
})
