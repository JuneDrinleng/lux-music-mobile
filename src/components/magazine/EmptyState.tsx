/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'

import { SecondaryButton } from './SecondaryButton'
import { TextButton } from './TextButton'

export const EmptyState = memo(({
  eyebrow,
  title,
  message,
  actionLabel,
  onAction,
  linkLabel,
  onLink,
  children,
}: {
  eyebrow?: string
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
  linkLabel?: string
  onLink?: () => void
  children?: ReactNode
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <View style={{ paddingTop: 34, alignItems: 'flex-start' }}>
      {eyebrow
        ? (
          <Text
            size={magType.eyebrow.size}
            color={r.eyebrow}
            style={{ fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}
          >{eyebrow}</Text>
          )
        : null}
      <Text
        size={26}
        color={r.display}
        style={{ fontWeight: '800', marginTop: eyebrow ? 8 : 0, letterSpacing: -0.5 }}
      >{title}</Text>
      {message
        ? <Text size={14} color={r.muted} style={{ marginTop: 8, lineHeight: 20 }}>{message}</Text>
        : null}
      {children}
      {actionLabel && onAction
        ? <SecondaryButton label={actionLabel} onPress={onAction} style={{ marginTop: 18, alignSelf: 'stretch' }} />
        : null}
      {linkLabel && onLink
        ? (
          <View style={{ marginTop: 12 }}>
            <TextButton label={linkLabel} onPress={onLink} />
          </View>
          )
        : null}
    </View>
  )
})
