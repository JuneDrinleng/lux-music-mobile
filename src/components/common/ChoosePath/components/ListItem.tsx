/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { memo } from 'react'
import { View, TouchableOpacity } from 'react-native'
import { MdiIcon } from '@/components/common/MdiIcon'
import Text from '@/components/common/Text'
import { Hairline } from '@/components/magazine'
import { type RowInfo, createStyle } from '@/utils/tools'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER } from '@/theme/magazineType'

export interface PathItem {
  name: string
  path: string
  isDir: boolean
  mtime?: Date
  desc?: string
  size?: number
  sizeText?: string
  disabled?: boolean
}

export default memo(({ item, onPress, rowInfo, last = false }: {
  item: PathItem
  onPress: (item: PathItem) => void
  rowInfo: RowInfo
  last?: boolean
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const meta = item.mtime ? new Date(item.mtime).toLocaleString() : (item.desc ?? item.sizeText ?? '')
  const icon = item.isDir ? 'folder-outline' : 'file-document-outline'
  const muted = Boolean(item.disabled)

  const body = (
    <View style={[styles.row, { width: rowInfo.rowWidth, opacity: muted ? 0.45 : 1 }]}>
      <View style={[styles.iconWrap, { backgroundColor: r.placeholder }]}>
        <MdiIcon name={icon} size={22} color={r.ink} />
      </View>
      <View style={styles.info}>
        <Text size={15} color={r.ink} style={styles.name} numberOfLines={1}>{item.name}</Text>
        {meta
          ? <Text size={12} color={r.muted} numberOfLines={1}>{meta}</Text>
          : null}
      </View>
      {item.isDir
        ? <MdiIcon name="chevron-right" size={20} color={r.quiet} />
        : item.sizeText
          ? <Text size={12} color={r.muted}>{item.sizeText}</Text>
          : null}
    </View>
  )

  return (
    <View style={styles.wrap}>
      {muted
        ? body
        : (
          <TouchableOpacity activeOpacity={0.75} onPress={() => { onPress(item) }} style={{ minHeight: 56 }}>
            {body}
          </TouchableOpacity>
          )}
      {last ? null : <Hairline />}
    </View>
  )
})

const useStyles = sharedLuxStyles(() => createStyle({
  wrap: {
    paddingHorizontal: PAGE_GUTTER,
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontWeight: '700',
  },
}))
