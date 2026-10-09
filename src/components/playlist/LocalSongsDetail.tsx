/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, FlatList, PermissionsAndroid, Platform, TouchableOpacity, View, type ListRenderItem } from 'react-native'

import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import Text from '@/components/common/Text'
import { getSourceTone } from '@/components/search/sourceTone'
import { LIST_IDS } from '@/config/constant'
import { playList } from '@/core/player/player'
import { setTempList } from '@/core/list'
import { setCachedPagePlayQualities } from '@/core/music/utils'
import { useI18n } from '@/lang'
import { listCachedEntries, removeCachedResource } from '@/plugins/player/utils'
import { forgetAudioCacheKeys } from '@/utils/audioCacheIndex'
import {
  fetchCachedSongMusicInfo,
  loadCachedSongCatalog,
  rememberResolvedCacheSong,
  withCachedCover,
} from '@/utils/cachedSongInfo'
import { sizeFormate } from '@/utils/common'
import { useStatusbarHeight } from '@/store/common/hook'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'
import {
  alignCachedSong,
  mergeLocalSongRows,
  parseAudioCacheKey,
  resolveCachedSongMetadata,
  type MergedLocalSong,
} from '@/utils/localSongRows'
import {
  collectDeviceSongs,
  importDeviceAudioLibrary,
  importFolderIntoLibrary,
  removeDeviceSongs,
} from '@/utils/localSongLibrary'
import PlaylistDetailHeader from './PlaylistDetailHeader'
import PlaylistDetailSongItem from './PlaylistDetailSongItem'

interface PageRow extends MergedLocalSong {
  musicInfo: LX.Music.MusicInfo
  needsRemoteMeta: boolean
}

const shiftAnim = new Animated.Value(0)

const localFileSong = (row: MergedLocalSong): LX.Music.MusicInfoLocal => {
  const filePath = row.id
  const base = filePath.split('/').pop() ?? filePath
  const dot = base.lastIndexOf('.')
  return {
    id: filePath,
    name: dot > 0 ? base.slice(0, dot) : base,
    singer: '',
    source: 'local',
    interval: null,
    meta: {
      albumName: '',
      filePath,
      songId: filePath,
      picUrl: '',
      ext: dot > 0 ? base.slice(dot + 1) : '',
    },
  }
}

const requestAudioPermission = async() => {
  const version = typeof Platform.Version == 'number' ? Platform.Version : parseInt(String(Platform.Version), 10)
  const permission = version >= 33
    ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO
    : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
  if (await PermissionsAndroid.check(permission)) return true
  const result = await PermissionsAndroid.request(permission)
  return result == PermissionsAndroid.RESULTS.GRANTED
}

export interface LocalSongsDetailProps {
  onClose: () => void
  bottomPadding?: number
}

const LocalSongsDetail = ({ onClose, bottomPadding = 0 }: LocalSongsDetailProps) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const choosePathRef = useRef<ChoosePathType>(null)
  const [rows, setRows] = useState<PageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Record<string, true>>({})
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const reloadGeneration = useRef(0)

  const hydrateRemoteMeta = useCallback(async(pending: PageRow[], generation: number) => {
    const queue = pending.filter(row => row.cacheKey && row.needsRemoteMeta)
    const worker = async() => {
      while (queue.length) {
        if (generation != reloadGeneration.current) return
        const row = queue.shift()
        const parsed = row?.cacheKey ? parseAudioCacheKey(row.cacheKey) : null
        if (!row?.cacheKey || !parsed) continue
        const fetched = await fetchCachedSongMusicInfo(parsed)
        if (!fetched || generation != reloadGeneration.current) continue
        const musicInfo = withCachedCover(alignCachedSong(fetched, parsed))
        await rememberResolvedCacheSong(row.cacheKey, musicInfo)
        if (generation != reloadGeneration.current) return
        setRows(current => current.map(item => {
          if (item.rowKey != row.rowKey) return item
          return { ...item, musicInfo, needsRemoteMeta: false, playable: true }
        }))
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()])
  }, [])

  const reload = useCallback(async() => {
    const generation = ++reloadGeneration.current
    setLoading(true)
    try {
      const devices = await collectDeviceSongs()
      const caches = await listCachedEntries().catch(() => [])
      const catalog = await loadCachedSongCatalog()
      const deviceById = new Map(devices.map(device => [`${device.musicInfo.source}_${device.musicInfo.id}`, device.musicInfo]))
      const merged = mergeLocalSongRows(
        devices.map(device => ({
          id: device.musicInfo.id,
          source: device.musicInfo.source,
          size: device.size,
        })),
        caches.map(cache => {
          const known = catalog.metaByKey.get(cache.key)
          const parsed = parseAudioCacheKey(cache.key)
          return {
            cacheKey: cache.key,
            cachedBytes: cache.cachedBytes,
            fullyCached: cache.fullyCached,
            source: known?.source ?? parsed?.source ?? null,
            id: known?.id ?? parsed?.id ?? null,
          }
        }),
      )
      const unknownName = t('local_songs_unknown_name')
      const pageRows = merged.map((row): PageRow => {
        if (row.origin == 'device') {
          return {
            ...row,
            musicInfo: deviceById.get(`${row.source}_${row.id}`) ?? localFileSong(row),
            needsRemoteMeta: false,
          }
        }
        const resolved = resolveCachedSongMetadata<LX.Music.MusicInfo>({
          cacheKey: row.cacheKey ?? '',
          userLists: catalog.userLists,
          listenList: catalog.listenList,
          playHistory: catalog.playHistory,
          metaStore: catalog.metaStore,
          keyedMeta: row.cacheKey ? catalog.metaByKey.get(row.cacheKey) ?? null : null,
          unknownName,
        })
        const musicInfo = withCachedCover(alignCachedSong(resolved.musicInfo, resolved.parsed) as LX.Music.MusicInfo)
        if (row.cacheKey && resolved.via != 'fallback') {
          const existing = catalog.metaByKey.get(row.cacheKey)
          if (!existing?.name || existing.name == row.cacheKey) void rememberResolvedCacheSong(row.cacheKey, musicInfo)
        }
        const parsed = resolved.parsed
        return {
          ...row,
          musicInfo,
          playable: parsed != null && parsed.source != 'unknown',
          needsRemoteMeta: resolved.via == 'fallback' && parsed != null && parsed.source != 'local' && parsed.source != 'unknown',
        }
      })
      if (generation != reloadGeneration.current) return
      setRows(pageRows)
      void hydrateRemoteMeta(pageRows, generation)
    } finally {
      if (generation == reloadGeneration.current) setLoading(false)
    }
  }, [hydrateRemoteMeta, t])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleClose = useCallback(() => {
    if (selecting) {
      setSelecting(false)
      setSelected({})
      return
    }
    onClose()
  }, [onClose, selecting])

  useBackHandler(useCallback(() => {
    handleClose()
    return true
  }, [handleClose]))

  const openFolderPicker = useCallback(() => {
    choosePathRef.current?.show({
      title: t('list_select_local_file_desc'),
      dirOnly: true,
      isPersist: true,
    })
  }, [t])

  const handleScan = useCallback(async() => {
    const granted = await requestAudioPermission()
    if (!granted) {
      toast(t('local_songs_permission_denied'))
      openFolderPicker()
      return
    }
    const count = await importDeviceAudioLibrary().catch(() => 0)
    await reload()
    if (!count) {
      toast(t('local_songs_scan_empty'))
      openFolderPicker()
      return
    }
    toast(t('local_songs_scan_done', { count }))
  }, [openFolderPicker, reload, t])

  const handleImportFolder = useCallback(async(path: string) => {
    const count = await importFolderIntoLibrary(path).catch(() => 0)
    await reload()
    toast(count ? t('local_songs_scan_done', { count }) : t('list_select_local_file_empty_tip'))
  }, [reload, t])

  const noteFor = useCallback((row: PageRow) => {
    const parts = [row.origin == 'device' ? t('local_songs_origin_device') : t('local_songs_origin_cache')]
    if (row.size != null && row.size > 0) parts.push(sizeFormate(row.size))
    if (row.origin == 'cache' && row.fullyCached != null) {
      parts.push(row.fullyCached ? t('local_songs_full') : t('local_songs_partial'))
    }
    return parts.join(' · ')
  }, [t])

  const handlePlay = useCallback(async(row: PageRow) => {
    if (selecting) {
      setSelected(current => {
        const next = { ...current }
        if (next[row.rowKey]) delete next[row.rowKey]
        else next[row.rowKey] = true
        return next
      })
      return
    }
    if (!row.playable) {
      toast(t('local_songs_play_missing'))
      return
    }
    let target = row
    if (row.needsRemoteMeta && row.cacheKey) {
      const parsed = parseAudioCacheKey(row.cacheKey)
      const fetched = parsed ? await fetchCachedSongMusicInfo(parsed) : null
      if (fetched && row.cacheKey) {
        const musicInfo = withCachedCover(alignCachedSong(fetched, parsed))
        await rememberResolvedCacheSong(row.cacheKey, musicInfo)
        target = { ...row, musicInfo, needsRemoteMeta: false, playable: true }
        setRows(current => current.map(item => item.rowKey == row.rowKey ? target : item))
      }
    }
    const playable = rowsRef.current
      .filter(item => item.playable)
      .map(item => item.rowKey == target.rowKey ? target : item)
    const index = playable.findIndex(item => item.rowKey == target.rowKey)
    if (index < 0) return
    setCachedPagePlayQualities(playable.filter(item => item.origin == 'cache').map(item => ({
      source: item.musicInfo.source,
      id: item.musicInfo.id,
      quality: item.quality,
    })))
    await setTempList('local-songs', playable.map(item => item.musicInfo))
    await playList(LIST_IDS.TEMP, index)
  }, [selecting, t])

  const removeRows = useCallback(async(targets: PageRow[]) => {
    const devices = targets.filter((row): row is PageRow & { musicInfo: LX.Music.MusicInfoLocal } => {
      return row.origin == 'device' && row.musicInfo.source == 'local'
    })
    const caches = targets.filter(row => row.origin == 'cache' && row.cacheKey)
    if (!devices.length && !caches.length) return
    const message = devices.length && caches.length
      ? t('local_songs_remove_mixed')
      : devices.length
        ? t('local_songs_remove_device')
        : t('local_songs_remove_cache')
    if (!await confirmDialog({ message, confirmButtonText: t('list_remove_tip_button') })) return
    const deleteFiles = devices.length
      ? await confirmDialog({
        message: t('local_songs_remove_device_file'),
        confirmButtonText: t('list_remove_tip_button'),
        cancelButtonText: t('cancel'),
      })
      : false
    if (devices.length) await removeDeviceSongs(devices.map(row => row.musicInfo), deleteFiles)
    const cacheKeys = caches.flatMap(row => row.cacheKeys.length ? [...row.cacheKeys] : (row.cacheKey ? [row.cacheKey] : []))
    for (const key of cacheKeys) await removeCachedResource(key).catch(() => {})
    await forgetAudioCacheKeys(cacheKeys)
    setSelected({})
    setSelecting(false)
    await reload()
  }, [reload, t])

  const selectedRows = useMemo(
    () => rows.filter(row => selected[row.rowKey]),
    [rows, selected],
  )

  const renderItem: ListRenderItem<PageRow> = useCallback(({ item }) => {
    return (
      <PlaylistDetailSongItem
        song={item.musicInfo}
        sourceTone={getSourceTone(item.musicInfo.source, colors)}
        shiftAnim={shiftAnim}
        detailNote={noteFor(item)}
        selecting={selecting}
        selected={Boolean(selected[item.rowKey])}
        canEdit={!selecting && (item.origin == 'device' || Boolean(item.cacheKey))}
        onLayout={() => {}}
        onPress={() => { void handlePlay(item) }}
        onRemove={() => { void removeRows([item]) }}
      />
    )
  }, [colors, handlePlay, noteFor, removeRows, selected, selecting])

  const header = useMemo(() => (
    <PlaylistDetailHeader
      statusBarHeight={statusBarHeight}
      cover={null}
      name={t('local_songs_title')}
      metaText={loading ? t('me_loading_songs') : t('local_songs_meta', { count: rows.length })}
      sectionTitle={t('me_songs')}
      canRename={false}
      actionLabel={t('local_songs_scan')}
      actionIcon="folder-search"
      onBack={handleClose}
      onActionPress={() => { void handleScan() }}
      onToggleSelect={() => {
        setSelecting(current => !current)
        setSelected({})
      }}
      selecting={selecting}
    />
  ), [handleClose, handleScan, loading, rows.length, selecting, statusBarHeight, t])

  return (
    <View style={styles.root}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + (selecting ? 72 : 0) }]}
        data={rows}
        renderItem={renderItem}
        keyExtractor={item => item.rowKey}
        ListHeaderComponent={header}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text size={13} color={colors.ink.meta}>{loading ? t('me_loading_songs') : t('me_no_songs')}</Text>
          </View>
        )}
        showsVerticalScrollIndicator={false}
      />
      {selecting
        ? (
            <View style={[styles.deleteBar, { bottom: bottomPadding + 12, backgroundColor: colors.surface.card }]}>
              <TouchableOpacity
                activeOpacity={0.84}
                disabled={!selectedRows.length}
                onPress={() => { void removeRows(selectedRows) }}
              >
                <Text size={15} color={selectedRows.length ? colors.ink.list : colors.ink.quiet}>
                  {t('local_songs_delete_selected', { count: selectedRows.length })}
                </Text>
              </TouchableOpacity>
            </View>
          )
        : null}
      <ChoosePath ref={choosePathRef} onConfirm={(path) => { void handleImportFolder(path) }} />
    </View>
  )
}

const useLuxStyles = sharedLuxStyles((colors: LuxColors) => (createStyle({
  root: {
    flex: 1,
    backgroundColor: colors.bg.app,
  },
  list: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
  },
  empty: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  deleteBar: {
    position: 'absolute',
    left: 18,
    right: 18,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
})))

export default memo(LocalSongsDetail)
