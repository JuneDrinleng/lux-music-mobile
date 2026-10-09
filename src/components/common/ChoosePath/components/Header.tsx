/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { memo, useCallback, useEffect, useRef } from 'react'
import { View } from 'react-native'
import Text from '@/components/common/Text'
import { IconButton, Rule } from '@/components/magazine'
import { createStyle } from '@/utils/tools'
import { getExternalStoragePaths, stat } from '@/utils/fs'
import { useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import NewFolderModal, { type NewFolderType } from './NewFolderModal'
import OpenStorageModal, { type OpenDirModalType } from './OpenStorageModal'
import type { PathItem } from './ListItem'

export default memo(({
  title,
  path,
  onRefreshDir,
  onOpenDir,
}: {
  title: string
  path: string
  onRefreshDir: (dir: string) => Promise<PathItem[]>
  onOpenDir: (dir: string) => Promise<PathItem[]>
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const newFolderTypeRef = useRef<NewFolderType>(null)
  const openDirModalTypeRef = useRef<OpenDirModalType>(null)
  const storagePathsRef = useRef<string[]>([])
  const statusBarHeight = useStatusbarHeight()

  const checkExternalStoragePath = useCallback(() => {
    storagePathsRef.current = []
    void getExternalStoragePaths().then(async(storagePaths) => {
      for (const storagePath of storagePaths) {
        try {
          if (!(await stat(storagePath)).canRead) continue
        } catch { continue }
        storagePathsRef.current.push(storagePath)
      }
    })
  }, [])
  useEffect(() => {
    checkExternalStoragePath()
  }, [checkExternalStoragePath])

  const refresh = () => {
    void onRefreshDir(path)
    checkExternalStoragePath()
  }

  const openStorage = () => {
    openDirModalTypeRef.current?.show(storagePathsRef.current)
  }

  const handleShowNewFolderModal = () => {
    newFolderTypeRef.current?.show(path)
  }

  const pathTail = path.split('/').filter(Boolean).pop() ?? path

  return (
    <>
      <View style={[styles.header, { paddingTop: statusBarHeight + 10, backgroundColor: r.paper }]} onStartShouldSetResponder={() => true}>
        <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.eyebrow}>{t('choose_path_eyebrow')}</Text>
        <View style={styles.titleRow}>
          <Text size={magType.sheetTitle.size} color={r.display} style={styles.title} numberOfLines={2}>{title || t('choose_path_title')}</Text>
          <View style={styles.actions}>
            <IconButton name="sd-card" accessibilityLabel={t('open_storage_select_path')} onPress={openStorage} size={22} />
            <IconButton name="folder-plus-outline" accessibilityLabel={t('create_new_folder')} onPress={handleShowNewFolderModal} size={22} />
            <IconButton name="refresh" accessibilityLabel={t('choose_path_refresh')} onPress={refresh} size={22} />
          </View>
        </View>
        <Rule compact gapTop={14} />
        <Text size={12} color={r.muted} style={styles.path} numberOfLines={2}>
          {path
            ? <>
                <Text size={12} color={r.muted}>{path.replace(/\/[^/]*$/, '/')}</Text>
                <Text size={12} color={r.ink} style={styles.pathTail}>{pathTail}</Text>
              </>
            : null}
        </Text>
      </View>
      <OpenStorageModal ref={openDirModalTypeRef} onOpenDir={onOpenDir} />
      <NewFolderModal ref={newFolderTypeRef} onRefreshDir={onRefreshDir} />
    </>
  )
})

const useStyles = sharedLuxStyles(() => createStyle({
  header: {
    flexGrow: 0,
    flexShrink: 0,
    paddingHorizontal: PAGE_GUTTER,
    paddingBottom: 8,
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 8,
  },
  title: {
    flex: 1,
    fontWeight: '800',
  },
  actions: {
    flexDirection: 'row',
  },
  path: {
    marginTop: 10,
    lineHeight: 18,
  },
  pathTail: {
    fontWeight: '700',
  },
}))
