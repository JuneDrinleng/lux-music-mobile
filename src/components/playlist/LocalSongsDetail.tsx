/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, FlatList, PermissionsAndroid, Platform, TouchableOpacity, View, type ListRenderItem } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import ChoosePath, { type ChoosePathType } from '@/components/common/ChoosePath'
import { Icon } from '@/components/common/Icon'
import { MdiIcon } from '@/components/common/MdiIcon'
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
import { arrShuffle, sizeFormate } from '@/utils/common'
import { useStatusbarHeight } from '@/store/common/hook'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { rgbaHex } from '@/theme/luxColorMath'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { type LuxColors } from '@/theme/luxTokens'
import {
  alignCachedSong,
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

const HERO_GRADIENT_ID = 'localSongsHero'

interface LocalSongsOverviewProps {
  statusBarHeight: number
  metaText: string
  deviceLabel: string
  cacheLabel: string
  deviceBytes: number
  cacheBytes: number
  selecting: boolean
  onBack: () => void
  onPlayAll: () => void
  onShuffle: () => void
  onToggleSelect: () => void
  onScan: () => void
}

const LocalSongsOverview = ({
  statusBarHeight,
  metaText,
  deviceLabel,
  cacheLabel,
  deviceBytes,
  cacheBytes,
  selecting,
  onBack,
  onPlayAll,
  onShuffle,
  onToggleSelect,
  onScan,
}: LocalSongsOverviewProps) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const t = useI18n()
  return (
    <View>
      <View style={[styles.backRow, { paddingTop: statusBarHeight + 18 }]}>
        <TouchableOpacity style={styles.backButton} activeOpacity={0.82} onPress={onBack}>
          <View style={styles.backButtonInner}>
            <Icon name="chevron-left" rawSize={22} color={colors.ink.input} />
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.heroShadow}>
        <View style={styles.hero}>
          <View style={styles.heroFill} pointerEvents="none">
            <Svg width="100%" height="100%">
              <Defs>
                <LinearGradient id={HERO_GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={colors.accent.soft} />
                  <Stop offset="0.58" stopColor={colors.surface.importSelected} />
                  <Stop offset="1" stopColor={colors.surface.card} />
                </LinearGradient>
              </Defs>
              <Rect width="100%" height="100%" fill={`url(#${HERO_GRADIENT_ID})`} />
            </Svg>
          </View>
          <View style={styles.heroBlob} pointerEvents="none" />
          <View style={styles.heroRow}>
            <View style={styles.tile}>
              <MdiIcon name="folder-music" size={46} color={colors.ink.chipActive} />
            </View>
            <View style={styles.heroText}>
              <Text size={22} color={colors.ink.strong} style={styles.heroTitle} numberOfLines={1}>
                {t('local_songs_title')}
              </Text>
              <Text size={12} color={colors.ink.meta} style={styles.heroMeta} numberOfLines={2}>{metaText}</Text>
              <View style={styles.bar}>
                {deviceBytes > 0 ? <View style={[styles.barDevice, { flex: deviceBytes }]} /> : null}
                {cacheBytes > 0 ? <View style={[styles.barCache, { flex: cacheBytes }]} /> : null}
              </View>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={styles.dotDevice} />
                  <Text size={11} color={colors.ink.secondary} style={styles.legendLabel} numberOfLines={1}>{deviceLabel}</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={styles.dotCache} />
                  <Text size={11} color={colors.ink.secondary} style={styles.legendLabel} numberOfLines={1}>{cacheLabel}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={styles.heroButtons}>
            <TouchableOpacity style={styles.playAll} activeOpacity={0.82} onPress={onPlayAll}>
              <MdiIcon name="play" size={20} color={colors.ink.onAccent} />
              <Text size={15} color={colors.ink.onAccent} style={styles.btnLabel} numberOfLines={1}>{t('play_all')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.shuffle} activeOpacity={0.82} onPress={onShuffle}>
              <MdiIcon name="shuffle-variant" size={19} color={colors.ink.list} />
              <Text size={15} color={colors.ink.list} style={styles.btnLabel} numberOfLines={1}>{t('play_list_random')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <View style={styles.sectionHeader}>
        <Text size={18} color={colors.ink.strong} style={styles.sectionTitle}>{t('me_songs')}</Text>
        <View style={styles.sectionActions}>
          <TouchableOpacity style={styles.sectionIcon} activeOpacity={0.8} onPress={onToggleSelect}>
            <MdiIcon
              name={selecting ? 'checkbox-marked' : 'checkbox-multiple-outline'}
              size={16}
              color={colors.ink.nearBlack}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sectionIcon} activeOpacity={0.8} onPress={onScan}>
            <MdiIcon name="folder-search" size={19} color={colors.ink.nearBlack} />
          </TouchableOpacity>
        </View>
      </View>
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
  const usage = useMemo(() => summarizeLocalSongUsage(rows), [rows])

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

  const header = (
    <LocalSongsOverview
      statusBarHeight={statusBarHeight}
      metaText={loading
        ? t('me_loading_songs')
        : t('local_songs_usage', { count: usage.count, size: sizeFormate(usage.totalBytes) })}
      deviceLabel={t('local_songs_usage_device', { size: sizeFormate(usage.deviceBytes) })}
      cacheLabel={t('local_songs_usage_cache', { size: sizeFormate(usage.cacheBytes) })}
      deviceBytes={usage.deviceBytes}
      cacheBytes={usage.cacheBytes}
      selecting={selecting}
      onBack={handleClose}
      onPlayAll={() => { void playPage(false) }}
      onShuffle={() => { void playPage(true) }}
      onToggleSelect={() => {
        setSelecting(current => !current)
        setSelected({})
      }}
      onScan={() => { void handleScan() }}
    />
  )

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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface.card,
    padding: 2,
    shadowColor: colors.shadow.ink,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  backButtonInner: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroShadow: {
    borderRadius: 24,
    marginBottom: 18,
    backgroundColor: colors.surface.card,
    shadowColor: colors.shadow.card,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  hero: {
    borderRadius: 24,
    padding: 18,
    overflow: 'hidden',
  },
  heroFill: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  heroBlob: {
    position: 'absolute',
    right: -40,
    top: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: rgbaHex(colors.accent.primary, 0.18),
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tile: {
    width: 92,
    height: 92,
    borderRadius: 18,
    backgroundColor: colors.accent.chip,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink.olive,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  heroText: {
    flex: 1,
    marginLeft: 16,
    minWidth: 0,
  },
  heroTitle: {
    fontWeight: '800',
  },
  heroMeta: {
    marginTop: 6,
    lineHeight: 18,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
    flexDirection: 'row',
    backgroundColor: rgbaHex(colors.surface.card, 0.8),
  },
  barDevice: {
    height: '100%',
    backgroundColor: colors.ink.olive,
  },
  barCache: {
    height: '100%',
    backgroundColor: colors.accent.primary,
  },
  legend: {
    marginTop: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  legendLabel: {
    flexShrink: 1,
  },
  dotDevice: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 4,
    backgroundColor: colors.ink.olive,
  },
  dotCache: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginRight: 4,
    backgroundColor: colors.accent.primary,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  playAll: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: colors.accent.highlight,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  shuffle: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.glass.fill78,
    borderWidth: 1,
    borderColor: colors.glass.backBorder,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnLabel: {
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  sectionTitle: {
    fontWeight: '700',
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sectionIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
})))

export default memo(LocalSongsDetail)
