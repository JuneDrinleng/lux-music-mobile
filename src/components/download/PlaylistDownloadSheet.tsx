/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md. */
import { useEffect, useState } from 'react'
import { ScrollView, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { MagazineSheet, MagSegmented, TextButton, Toggle } from '@/components/magazine'
import { downloadQueue } from '@/core/download'
import { DOWNLOAD_QUALITIES, downloadSheetPlan, type DownloadQuality } from '@/core/download/presentation'
import { useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { sizeFormate } from '@/utils'
import { createStyle, toast } from '@/utils/tools'
import { DownloadRow } from './DownloadRow'
import { useDownloadPreferences, useDownloads } from './hooks'

const styles = createStyle({ footer: { borderTopWidth: 2, marginHorizontal: -22, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26, flexDirection: 'row', gap: 16, alignItems: 'center' }, primary: { flex: 1, height: 46, borderRadius: 23, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, badge: { borderRadius: 10, paddingHorizontal: 7 }, bold: { fontWeight: '800' } })
export const PlaylistDownloadSheet = ({ songs, playlistId, name, onClose }: { songs: LX.Music.MusicInfo[], playlistId: string, name: string, onClose: () => void }) => {
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const items = useDownloads()
  const defaults = useDownloadPreferences()
  const [quality, setQuality] = useState<DownloadQuality>(defaults.quality)
  const [wifiOnly, setWifiOnly] = useState(defaults.wifiOnly)
  const [selected, setSelected] = useState(true)
  const [edited, setEdited] = useState(false)
  useEffect(() => {
    if (!edited) { setQuality(defaults.quality); setWifiOnly(defaults.wifiOnly) }
  }, [defaults, edited])
  const [free, setFree] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    let active = true
    void downloadQueue?.availableBytes().then(bytes => { if (active) setFree(bytes) }).catch(() => {})
    return () => { active = false }
  }, [items])
  const plan = downloadSheetPlan(songs, items, quality, wifiOnly, free)
  const start = async() => {
    if (!downloadQueue || submitting || !plan.enough || !plan.count || !selected) return
    setSubmitting(true)
    try { await downloadQueue.enqueuePlaylist(plan.requests, playlistId, name); onClose() } catch { toast(t('download_error')); setSubmitting(false) }
  }
  const disabled = !downloadQueue || submitting || !plan.enough || !plan.count || !selected
  return <MagazineSheet visible onClose={onClose} downloadLayout heightRatio={600 / 844}
    eyebrow={t('download_sheet_eyebrow', { name })} title={t('download_entire_playlist')}
    figure={{ value: String(plan.count), unit: t('download_estimate', { size: sizeFormate(plan.estimate) }) }}
    meta={t('download_skip', { count: plan.skipped })}
    headerAction={{ text: t('list_select_all'), onPress: () => { setSelected(!selected) } }}
    footerContent={<View style={[styles.footer, { borderTopColor: r.ink }]}>
      <TextButton label={t('cancel')} underline={false} onPress={onClose} />
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={() => { void start() }} activeOpacity={0.7} style={[styles.primary, { backgroundColor: r.ink, opacity: disabled ? 0.4 : 1 }]}>
        <Text size={15} color={r.onInk} style={styles.bold}>{t('download_start')}</Text><View style={[styles.badge, { backgroundColor: r.accent }]}><Text size={12} color={r.onAccent} style={styles.bold}>{selected ? plan.pending : 0}</Text></View>
      </TouchableOpacity>
    </View>}>
    <ScrollView bounces={false}>
      <DownloadRow title={t('download_quality')} trailing={<MagSegmented compact style={{ borderRadius: 16 }} items={DOWNLOAD_QUALITIES.map(id => ({ id, label: t(`download_quality_${id}`) }))} value={quality} onChange={id => { setEdited(true); setQuality(id as DownloadQuality) }} />} />
      <DownloadRow title={t('download_wifi')} subtitle={t('download_wifi_note')} trailing={<Toggle compact value={wifiOnly} onChange={value => { setEdited(true); setWifiOnly(value) }} accessibilityLabel={t('download_wifi')} />} />
      <DownloadRow title={t('download_storage')} subtitle={free == null ? t('download_storage_loading') : t('download_storage_status', { size: sizeFormate(free), status: t(plan.enough ? 'download_storage_enough' : 'download_storage_low') })} trailing={<Text size={12} color={r.muted}>{plan.enough ? '✓' : '!'}</Text>} />
    </ScrollView>
  </MagazineSheet>
}
