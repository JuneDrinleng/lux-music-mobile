/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, FlatList, PermissionsAndroid, Platform, View, useWindowDimensions, type ListRenderItem, type ViewToken } from 'react-native'

import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import Text from '@/components/common/Text'
import { useOverlaySlideTransition } from '@/components/common/overlaySlideTransition'
import {
  EmptyState,
  IconButton,
  MagTopBar,
  PrimaryButton,
  SecondaryButton,
  TextTabs,
} from '@/components/magazine'
import { LIST_IDS } from '@/config/constant'
import { playList } from '@/core/player/player'
import { setTempList } from '@/core/list'
import { setCachedPagePlayQualities } from '@/core/music/utils'
import { useI18n } from '@/lang'
import { initial as playerInitial, isInitialized } from '@/plugins/player'
import { listCachedEntries, removeCachedResource } from '@/plugins/player/utils'
import settingState from '@/store/setting/state'
import { forgetAudioCacheKeys } from '@/utils/audioCacheIndex'
import {
  fetchCachedSongMusicInfo,
  loadCachedSongCatalog,
  rememberResolvedCacheSong,
  withCachedCover,
} from '@/utils/cachedSongInfo'
import { arrShuffle, sizeFormate } from '@/utils/common'
import { useStatusbarHeight } from '@/store/common/hook'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import {
  alignCachedSong,
  hasCachedSongMetadata,
  mergeLocalSongRows,
  parseAudioCacheKey,
  resolveCachedSongMetadata,
  summarizeLocalSongUsage,
  type MergedLocalSong,
} from '@/utils/localSongRows'
import {
  collectDeviceSongs,
  importDeviceAudioLibrary,
  importFolderIntoLibrary,
  removeDeviceSongs,
} from '@/utils/localSongLibrary'
import PlaylistDetailSongItem from './PlaylistDetailSongItem'
import { requestDeviceSongCover } from '@/utils/localSongCoverLookup'

/** Open the native audio cache so listCachedEntries sees files from earlier sessions. */
const ensurePlayerCacheReadable = async() => {
  if (isInitialized()) return
  const cacheSizeRaw = settingState.setting['player.cacheSize']
  const cacheSize = cacheSizeRaw ? parseInt(cacheSizeRaw, 10) : 0
  await playerInitial({
    volume: settingState.setting['player.volume'],
    playRate: settingState.setting['player.playbackRate'],
    cacheSize: Number.isFinite(cacheSize) ? Math.max(0, cacheSize) : 0,
    isHandleAudioFocus: settingState.setting['player.isHandleAudioFocus'],
    isEnableAudioOffload: settingState.setting['player.isEnableAudioOffload'],
  })
  for (let attempt = 0; attempt < 40 && !isInitialized(); attempt += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 50))
  }
}

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

type LocalFilter = 'all' | 'device' | 'cache'

interface LocalSongsOverviewProps {
  statusBarHeight: number
  count: number
  storageMeta: string
  filter: LocalFilter
  filterTabs: Array<{ id: string, label: string }>
  selecting: boolean
  onBack: () => void
  onPlayAll: () => void
  onShuffle: () => void
  onToggleSelect: () => void
  onScan: () => void
  onFilterChange: (id: string) => void
}

const LocalSongsOverview = ({
  statusBarHeight,
  count,
  storageMeta,
  filter,
  filterTabs,
  selecting,
  onBack,
  onPlayAll,
  onShuffle,
  onToggleSelect,
  onScan,
  onFilterChange,
}: LocalSongsOverviewProps) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  return (
    <View style={{ paddingTop: statusBarHeight }}>
      <MagTopBar
        onBack={onBack}
        trailing={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <IconButton
              name="folder-search-outline"
              size={22}
              accessibilityLabel={t('local_songs_scan')}
              onPress={onScan}
            />
            <IconButton
              name={selecting ? 'checkbox-marked' : 'checkbox-multiple-outline'}
              size={22}
              accessibilityLabel={t('library_select_manage')}
              onPress={onToggleSelect}
            />
          </View>
        }
      />
      <Text size={magType.eyebrow.size} color={r.eyebrow} style={{ fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase', marginTop: 18 }}>
        {t('local_songs_eyebrow')}
      </Text>
      <Text size={magType.h1.size} color={r.display} style={{ fontWeight: '800', letterSpacing: -1, marginTop: 8 }}>
        {t('local_songs_title')}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 12 }}>
        <Text size={56} color={r.display} style={{ fontWeight: '800', letterSpacing: -2, fontVariant: ['tabular-nums'], lineHeight: 56 }}>
          {count}
        </Text>
        {t('library_tracks_unit')
          ? <Text size={18} color={r.muted} style={{ fontWeight: '700', marginLeft: 6, marginBottom: 8 }}>{t('library_tracks_unit')}</Text>
          : null}
      </View>
      <Text size={magType.meta.size} color={r.muted} style={{ marginTop: 8 }}>{storageMeta}</Text>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 22 }}>
        <PrimaryButton label={t('play_all')} icon="play" onPress={onPlayAll} style={{ flex: 1 }} />
        <SecondaryButton label={t('play_list_random')} icon="shuffle-variant" onPress={onShuffle} style={{ flex: 1 }} />
      </View>
      <TextTabs
        items={filterTabs}
        value={filter}
        onChange={onFilterChange}
        style={{ marginTop: 22 }}
      />
    </View>
  )
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
  const { width } = useWindowDimensions()
  const choosePathRef = useRef<ChoosePathType>(null)
  const [rows, setRows] = useState<PageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Record<string, true>>({})
  const [filter, setFilter] = useState<LocalFilter>('all')
  const r = magazineRoles(colors)
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const reloadGeneration = useRef(0)
  const { style: sceneStyle, requestClose } = useOverlaySlideTransition(width)
  const coverViewabilityConfig = useRef({ itemVisiblePercentThreshold: 25, minimumViewTime: 60 }).current

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
      await ensurePlayerCacheReadable().catch(() => {})
      if (generation != reloadGeneration.current) return
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
          if (!existing || !hasCachedSongMetadata(existing, row.cacheKey)) void rememberResolvedCacheSong(row.cacheKey, musicInfo)
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

  const applyFoundCover = useCallback((rowKey: string, url: string) => {
    setRows(current => current.map(item => {
      if (item.rowKey != rowKey || item.musicInfo.meta.picUrl) return item
      return {
        ...item,
        musicInfo: {
          ...item.musicInfo,
          meta: { ...item.musicInfo.meta, picUrl: url },
        },
      }
    }))
  }, [])

  const queueDeviceCovers = useCallback((list: readonly PageRow[]) => {
    for (const row of list) {
      if (row.origin != 'device' || row.musicInfo.source != 'local' || row.musicInfo.meta.picUrl) continue
      const info = row.musicInfo
      if (info.source != 'local') continue
      void requestDeviceSongCover(info).then(url => {
        if (url) applyFoundCover(row.rowKey, url)
      })
    }
  }, [applyFoundCover])

  const onCoverViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    const visible: PageRow[] = []
    for (const token of info.viewableItems) {
      const row = token.item as PageRow | null | undefined
      if (row?.origin == 'device') visible.push(row)
    }
    if (visible.length) queueDeviceCovers(visible)
  }).current

  const deviceCoverKey = useMemo(
    () => rows.filter(row => row.origin == 'device').map(row => row.id).join('\n'),
    [rows],
  )

  useEffect(() => {
    queueDeviceCovers(rowsRef.current.filter(row => row.origin == 'device').slice(0, 10))
  }, [deviceCoverKey, queueDeviceCovers])

  const handleClose = useCallback(() => {
    if (selecting) {
      setSelecting(false)
      setSelected({})
      return
    }
    requestClose(onClose)
  }, [onClose, requestClose, selecting])

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
    if (row.musicInfo.singer) parts.push(row.musicInfo.singer)
    if (row.size != null && row.size > 0) parts.push(sizeFormate(row.size))
    return parts.join(' · ')
  }, [t])
  const statusFor = useCallback((row: PageRow) => {
    if (row.origin != 'cache' || row.fullyCached == null) return null
    return row.fullyCached ? t('local_songs_full') : t('local_songs_partial')
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

  const filteredRows = useMemo(() => {
    if (filter == 'device') return rows.filter(row => row.origin == 'device')
    if (filter == 'cache') return rows.filter(row => row.origin == 'cache')
    return rows
  }, [filter, rows])
  const selectedRows = useMemo(
    () => filteredRows.filter(row => selected[row.rowKey]),
    [filteredRows, selected],
  )
  const usage = useMemo(() => summarizeLocalSongUsage(rows), [rows])
  const deviceCount = useMemo(() => rows.filter(row => row.origin == 'device').length, [rows])
  const cacheCount = useMemo(() => rows.filter(row => row.origin == 'cache').length, [rows])
  const filterTabs = useMemo(() => [
    { id: 'all', label: t('local_songs_tab_all', { count: rows.length }) },
    { id: 'device', label: t('local_songs_tab_device', { count: deviceCount }) },
    { id: 'cache', label: t('local_songs_tab_cache', { count: cacheCount }) },
  ], [cacheCount, deviceCount, rows.length, t])

  const playPage = useCallback(async(shuffle: boolean) => {
    const playable = rowsRef.current.filter(item => item.playable)
    if (!playable.length) {
      toast(rowsRef.current.length ? t('local_songs_play_missing') : t('me_no_songs'))
      return
    }
    const queue = shuffle ? arrShuffle(playable.slice()) : playable
    setCachedPagePlayQualities(queue.filter(item => item.origin == 'cache').map(item => ({
      source: item.musicInfo.source,
      id: item.musicInfo.id,
      quality: item.quality,
    })))
    await setTempList('local-songs', queue.map(item => item.musicInfo))
    await playList(LIST_IDS.TEMP, 0)
  }, [t])

  const renderItem: ListRenderItem<PageRow> = useCallback(({ item, index }) => {
    return (
      <PlaylistDetailSongItem
        song={item.musicInfo}
        index={index}
        shiftAnim={shiftAnim}
        detailNote={noteFor(item)}
        statusLabel={statusFor(item)}
        selecting={selecting}
        selected={Boolean(selected[item.rowKey])}
        canEdit={!selecting && (item.origin == 'device' || Boolean(item.cacheKey))}
        last={index >= filteredRows.length - 1}
        onLayout={() => {}}
        onPress={() => { void handlePlay(item) }}
        onRemove={() => { void removeRows([item]) }}
      />
    )
  }, [filteredRows.length, handlePlay, noteFor, removeRows, selected, selecting, statusFor])

  const header = (
    <LocalSongsOverview
      statusBarHeight={statusBarHeight}
      count={loading ? 0 : usage.count}
      storageMeta={loading
        ? t('me_loading_songs')
        : t('local_songs_storage_meta', {
          total: sizeFormate(usage.totalBytes),
          device: sizeFormate(usage.deviceBytes),
          cache: sizeFormate(usage.cacheBytes),
        })}
      filter={filter}
      filterTabs={filterTabs}
      selecting={selecting}
      onBack={handleClose}
      onPlayAll={() => { void playPage(false) }}
      onShuffle={() => { void playPage(true) }}
      onToggleSelect={() => {
        setSelecting(current => !current)
        setSelected({})
      }}
      onScan={() => { void handleScan() }}
      onFilterChange={(id) => { setFilter(id as LocalFilter) }}
    />
  )

  return (
    <Animated.View style={[styles.root, sceneStyle, { backgroundColor: r.paper }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + (selecting ? 72 : 0) }]}
        data={filteredRows}
        renderItem={renderItem}
        keyExtractor={item => item.rowKey}
        ListHeaderComponent={header}
        ListEmptyComponent={(
          <EmptyState
            eyebrow={loading ? 'LOADING' : 'EMPTY · 0'}
            title={loading ? t('me_loading_songs') : t('me_no_songs')}
          />
        )}
        showsVerticalScrollIndicator={false}
        onViewableItemsChanged={onCoverViewableItemsChanged}
        viewabilityConfig={coverViewabilityConfig}
      />
      {selecting
        ? (
            <View style={[styles.deleteBar, { bottom: bottomPadding + 12, borderTopColor: r.ink }]}>
              <PrimaryButton
                label={t('local_songs_delete_selected', { count: selectedRows.length })}
                danger
                disabled={!selectedRows.length}
                icon="trash-can-outline"
                onPress={() => { void removeRows(selectedRows) }}
                style={{ alignSelf: 'stretch' }}
              />
            </View>
          )
        : null}
      <ChoosePath ref={choosePathRef} onConfirm={(path) => { void handleImportFolder(path) }} />
    </Animated.View>
  )
}

const useLuxStyles = sharedLuxStyles(() => createStyle({
  root: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  content: {
    paddingHorizontal: PAGE_GUTTER,
  },
  deleteBar: {
    position: 'absolute',
    left: PAGE_GUTTER,
    right: PAGE_GUTTER,
    paddingTop: 12,
    borderTopWidth: 1,
  },
}))

export default memo(LocalSongsDetail)
