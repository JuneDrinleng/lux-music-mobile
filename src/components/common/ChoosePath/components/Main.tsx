/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useI18n } from '@/lang'
import { createStyle, getRowInfo } from '@/utils/tools'
import { useEffect, useMemo, useRef } from 'react'
import { View, FlatList, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { Hairline } from '@/components/magazine'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER } from '@/theme/magazineType'

import ListItem, { type PathItem } from './ListItem'
import LoadingMask, { type LoadingMaskType } from '@/components/common/LoadingMask'

export default ({ list, loading, onSetPath, toParentDir }: {
  list: PathItem[]
  loading: boolean
  onSetPath: (item: PathItem) => void
  toParentDir: () => void
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const loadingMaskRef = useRef<LoadingMaskType>(null)
  const rowInfo = useRef(getRowInfo('full'))

  useEffect(() => {
    loadingMaskRef.current?.setVisible(loading)
  }, [loading])

  const ParentItemComponent = useMemo(() => (
    <View style={styles.parentWrap}>
      <TouchableOpacity style={styles.parent} activeOpacity={0.75} onPress={toParentDir}>
        <View style={[styles.parentIcon, { backgroundColor: r.placeholder }]}>
          <MdiIcon name="arrow-up" size={22} color={r.ink} />
        </View>
        <Text size={15} color={r.ink} style={styles.parentLabel}>{t('parent_dir_name')}</Text>
      </TouchableOpacity>
      <Hairline />
    </View>
  ), [r.ink, r.placeholder, styles.parent, styles.parentIcon, styles.parentLabel, styles.parentWrap, t, toParentDir])

  return (
    <View style={styles.main}>
      {ParentItemComponent}
      <FlatList
        keyboardShouldPersistTaps="always"
        style={styles.list}
        data={list}
        numColumns={rowInfo.current.rowNum}
        renderItem={({ item, index }) => (
          <ListItem
            item={item}
            rowInfo={rowInfo.current}
            onPress={onSetPath}
            last={index === list.length - 1}
          />
        )}
        keyExtractor={item => item.path + '/' + item.name}
        removeClippedSubviews={true}
      />
      <LoadingMask ref={loadingMaskRef} />
    </View>
  )
}

const useStyles = sharedLuxStyles(() => createStyle({
  main: {
    flexGrow: 1,
    flexShrink: 1,
    overflow: 'hidden',
  },
  list: {
    flexGrow: 1,
    flexShrink: 1,
  },
  parentWrap: {
    paddingHorizontal: PAGE_GUTTER,
  },
  parent: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  parentIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentLabel: {
    fontWeight: '700',
  },
}))
