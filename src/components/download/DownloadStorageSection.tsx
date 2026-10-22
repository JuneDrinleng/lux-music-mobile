/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
import { useEffect, useRef, useState } from 'react'
import { AppState, View } from 'react-native'
import Text from '@/components/common/Text'
import { MdiIcon } from '@/components/common/MdiIcon'
import { MagSegmented, SecondaryButton, SectionHeader, SettingRow, Toggle } from '@/components/magazine'
import { downloadQueue, isIgnoringDownloadBatteryOptimizations, openDownloadBatterySettings } from '@/core/download'
import { DOWNLOAD_QUALITIES, downloadedPlaylists, downloadQueueAction, downloadUsage, type DownloadQuality } from '@/core/download/presentation'
import { useI18n } from '@/lang'
import { getCacheSize } from '@/plugins/player/utils'
import { useSettingValue } from '@/store/setting/hook'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { sizeFormate } from '@/utils'
import { confirmDialog, createStyle, toast } from '@/utils/tools'
import { DownloadRow } from './DownloadRow'
import { setDownloadPreferences, useDownloadPreferences, useDownloads } from './hooks'

const styles = createStyle({ figure: { flexDirection: 'row', alignItems: 'baseline', marginTop: 12 }, number: { fontSize: 56, lineHeight: 60, fontWeight: '800' }, unit: { fontWeight: '700', marginLeft: 6 }, bar: { flexDirection: 'row', height: 10, marginTop: 8 }, legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 6 } })
export const DownloadStorageSection = ({ refreshToken }: { refreshToken: string }) => {
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const items = useDownloads()
  const preferences = useDownloadPreferences()
  const limitSetting = useSettingValue('player.cacheSize')
  const limit = Math.max(0, Number(limitSetting) || 0) * 1024 ** 2
  const previous = useRef<{ bytes: number, time: number } | null>(null)
  const [speed, setSpeed] = useState(0)
  useEffect(() => {
    const bytes = items.reduce((sum, item) => sum + item.bytes, 0)
    const time = Date.now()
    const last = previous.current
    if (last && time > last.time) setSpeed(Math.max(0, (bytes - last.bytes) * 1000 / (time - last.time)))
    previous.current = { bytes, time }
  }, [items])
  const [cache, setCache] = useState(0)
  const [battery, setBattery] = useState<boolean | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)
  const [qualityOpen, setQualityOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let active = true
    const refresh = () => {
      void getCacheSize().then(size => { if (active) setCache(Number(size)) }).catch(() => {})
      void isIgnoringDownloadBatteryOptimizations().then(value => { if (active) setBattery(value) }).catch(() => {})
    }
    refresh()
    const subscription = AppState.addEventListener('change', state => { if (state == 'active') refresh() })
    return () => { active = false; subscription.remove() }
  }, [refreshToken])
  const usage = downloadUsage(items, cache, limit)
  const groups = downloadedPlaylists(items)
  const active = items.filter(item => item.state == 'queued' || item.state == 'running').length
  const current = items.find(item => item.state == 'running' || item.state == 'queued')
  const playlist = Object.entries(current?.playlists ?? {})[0]
  const queueItems = playlist ? items.filter(item => item.playlists?.[playlist[0]] != null) : items
  const queueSummary = t('download_queue_summary', { name: playlist?.[1] ?? t('download_queue'), done: queueItems.filter(item => item.state == 'done').length, count: queueItems.length, speed: sizeFormate(active ? speed : 0) })
  const run = async(action: () => Promise<unknown>) => {
    if (busy) return
    setBusy(true)
    try { await action() } catch { toast(t('download_error')) } finally { setBusy(false) }
  }
  const remove = async(id: string, name: string) => {
    const confirmed = await confirmDialog({ message: t('download_delete_confirm', { name }), confirmButtonText: t('list_remove_tip_button') })
    if (confirmed) await run(async() => downloadQueue?.removePlaylist(id))
  }
  return <View>
    <View style={styles.figure}><Text size={56} color={r.ink} style={styles.number}>{(usage.total / 1024 ** 3).toFixed(1)}</Text><Text size={15} color={r.ink} style={styles.unit}>{t('download_used_gb')}</Text></View>
    <View style={[styles.bar, { backgroundColor: r.hairline }]} accessibilityLabel={t('download_usage_accessibility', { downloads: sizeFormate(usage.downloads), cache: sizeFormate(usage.cache) })}>
      <View style={{ width: `${usage.downloadFraction * 100}%`, backgroundColor: r.ink }} pointerEvents="none" /><View style={{ width: `${usage.cacheFraction * 100}%`, backgroundColor: r.accent }} pointerEvents="none" />
    </View>
    <View style={styles.legend}><Text size={12} color={r.muted}>{t('download_usage_downloads', { size: sizeFormate(usage.downloads) })}</Text><Text size={12} color={r.accentInk}>{t('download_usage_cache', { size: sizeFormate(usage.cache) })}</Text><Text size={12} color={r.muted}>{t('download_usage_limit', { size: sizeFormate(limit) })}</Text></View>
    <SectionHeader title={t('download_title')} meta={t('download_active', { count: active })} compactRule />
    <DownloadRow title={t('download_queue')} subtitle={queueSummary} trailing={<MdiIcon name={queueOpen ? 'chevron-down' : 'chevron-right'} size={18} color={r.ink} />} onPress={() => { setQueueOpen(!queueOpen) }} />
    {queueOpen ? <View>
      {!items.length ? <Text size={12} color={r.muted}>{t('download_queue_empty')}</Text> : null}
      {items.map(item => {
        const action = downloadQueueAction(item.state)
        const percent = Math.min(100, Math.floor(item.bytes / (Math.max(1, item.total ?? item.estimatedSize)) * 100))
        return <DownloadRow key={item.key} title={item.musicInfo.name} subtitle={`${t(`download_state_${item.state}`)} · ${percent}% · ${sizeFormate(item.bytes)}`}
          trailing={action ? <SecondaryButton compact disabled={busy} label={t(`download_action_${action}`)} onPress={() => { void run(async() => downloadQueue?.command(item.key, action)) }} /> : undefined} />
      })}
    </View> : null}
    <DownloadRow title={t('download_wifi')} trailing={<Toggle compact value={preferences.wifiOnly} onChange={wifiOnly => { setDownloadPreferences({ wifiOnly }) }} accessibilityLabel={t('download_wifi')} />} />
    <DownloadRow title={t('download_default_quality')} subtitle={t(`download_quality_${preferences.quality}`)} trailing={<MdiIcon name="chevron-right" size={18} color={r.ink} />} onPress={() => { setQualityOpen(!qualityOpen) }} />
    {qualityOpen ? <MagSegmented compact style={{ borderRadius: 16, marginVertical: 8 }} items={DOWNLOAD_QUALITIES.map(id => ({ id, label: t(`download_quality_${id}`) }))} value={preferences.quality} onChange={id => { setDownloadPreferences({ quality: id as DownloadQuality }); setQualityOpen(false) }} /> : null}
    {battery === false ? <SettingRow icon="battery-outline" iconBg={r.iconWrap.purple} title={t('download_battery_hint')} trailing={<SecondaryButton compact label={t('download_battery_settings')} onPress={() => { void openDownloadBatterySettings().then(opened => { if (!opened) toast(t('download_error')) }).catch(() => { toast(t('download_error')) }) }} />} /> : null}
    <SectionHeader title={t('download_playlists')} compactRule />
    {!groups.length ? <Text size={12} color={r.muted}>{t('download_playlists_empty')}</Text> : null}
    {groups.map(group => <DownloadRow key={group.id} title={group.name || t('download_unassigned')} subtitle={t('download_playlist_size', { count: group.count, size: sizeFormate(group.bytes) })} trailing={<SecondaryButton compact disabled={busy} label={t('download_delete')} onPress={() => { void remove(group.id, group.name || t('download_unassigned')) }} />} />)}
  </View>
}
