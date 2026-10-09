/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { memo } from 'react'
import { View } from 'react-native'
import { PrimaryButton, SecondaryButton } from '@/components/magazine'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

export default memo(({ onConfirm, onHide, dirOnly }: {
  onConfirm: () => void
  onHide: () => void
  dirOnly: boolean
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()

  return (
    <View style={[styles.footer, { backgroundColor: r.paper }]}>
      <SecondaryButton
        label={t('cancel')}
        onPress={onHide}
        style={dirOnly ? styles.btn : styles.full}
      />
      {dirOnly
        ? (
          <PrimaryButton
            label={t('choose_path_save_here')}
            onPress={onConfirm}
            style={styles.btn}
          />
          )
        : null}
    </View>
  )
})

const useStyles = sharedLuxStyles(() => createStyle({
  footer: {
    flexGrow: 0,
    flexShrink: 0,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: PAGE_GUTTER,
    paddingTop: 12,
    paddingBottom: 22,
  },
  btn: {
    flex: 1,
  },
  full: {
    flex: 1,
  },
}))
