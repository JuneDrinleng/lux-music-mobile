/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Checkbox, MagazineSheet, MagazineSheetRow, PrimaryButton, SecondaryButton, SourceTag } from '@/components/magazine'
import { getListMusics, overwriteListMusics, removeListMusics } from '@/core/list'
import { useI18n } from '@/lang'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { getActiveSpace } from '@/utils/dataSpace'
import { applyPlaylistDedupe, findPlaylistDuplicates } from '@/utils/playlistDedupe'
import { confirmDialog, createStyle, toast } from '@/utils/tools'

/** Mounted afresh for each review, so occurrence selections belong to one snapshot. */
export default function PlaylistDedupeSheet({ listId, songs, onClose, onChanged }: {
  listId: string
  songs: LX.Music.MusicInfo[]
  onClose: () => void
  onChanged: (listId: string) => Promise<void>
}) {
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const [spaceId] = useState(getActiveSpace)
  const groups = useMemo(() => findPlaylistDuplicates(songs), [songs])
  const rows = useMemo(() => groups.flatMap(group => group.indices.map((index, position) => ({ index, first: group.indices[0], keep: position === 0 }))), [groups])
  const [checked, setChecked] = useState(() => new Set(groups.flatMap(group => group.indices.slice(1))))
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const count = checked.size
  const submit = async() => {
    if (busyRef.current || !count) return
    busyRef.current = true
    setBusy(true)
    try {
      const confirmed = await confirmDialog({
        message: t('list_remove_music_multi_tip', { num: count }),
        confirmButtonText: t('list_remove_tip_button'),
      })
      if (!confirmed) return
      const applied = await applyPlaylistDedupe(songs, checked, {
        read: async() => getListMusics(listId),
        isCurrent: () => getActiveSpace() === spaceId,
        remove: async(ids) => removeListMusics(listId, ids),
        overwrite: async(kept) => overwriteListMusics(listId, kept),
      })
      if (!applied) toast(t('playlist_dedupe_changed'))
      if (getActiveSpace() === spaceId) await onChanged(listId)
      onClose()
    } catch {
      toast(t('playlist_dedupe_failed'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }
  return (
    <MagazineSheet visible onClose={() => { if (!busyRef.current) onClose() }} timerLayout
      title={t('playlist_dedupe')} meta={t('playlist_dedupe_rule')}
      empty={{ text: t('playlist_dedupe_empty') }}
      footerContent={
        <View style={styles.footer}>
          <SecondaryButton compact label={t('cancel')} disabled={busy} onPress={onClose} />
          <PrimaryButton compact labelSize={13} label={t('playlist_dedupe_confirm', { num: count })}
            disabled={busy || !count} onPress={() => { void submit() }} style={{ flex: 1 }} />
        </View>
      }
    >
      {rows.length
        ? <FlatList data={rows} keyExtractor={row => String(row.index)} renderItem={({ item, index }) => {
          const song = songs[item.index]
          return (
              <View>
                {item.keep ? <Text size={12} color={r.muted} style={styles.group}>{t('playlist_dedupe_group', { num: item.first + 1 })}</Text> : null}
                <MagazineSheetRow reviewLayout title={song.name} coverUri={song.meta.picUrl} last={index === rows.length - 1}
                  subtitle={<View style={styles.subtitle}>
                    <SourceTag source={song.source} label={song.source} />
                    <Text size={12} color={r.muted} numberOfLines={1} style={{ flexShrink: 1 }}>{song.singer} · {song.interval}</Text>
                  </View>}
                  trailing={item.keep
                    ? <Text size={12} color={r.muted}>{t('playlist_dedupe_keep')}</Text>
                    : <TouchableOpacity style={styles.check} hitSlop={8} disabled={busy} activeOpacity={0.7}
                        accessibilityRole="checkbox" accessibilityLabel={t('playlist_dedupe_remove_song', { name: song.name })}
                        accessibilityState={{ checked: checked.has(item.index), disabled: busy }}
                        onPress={() => {
                          setChecked(current => {
                            const next = new Set(current)
                            if (next.has(item.index)) next.delete(item.index)
                            else next.add(item.index)
                            return next
                          })
                        }}>
                        <Checkbox checked={checked.has(item.index)} />
                      </TouchableOpacity>}
                />
              </View>
          )
        }} />
        : null}
    </MagazineSheet>
  )
}

const useStyles = sharedLuxStyles(colors => createStyle({
  footer: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 18, borderTopWidth: 2, borderTopColor: magazineRoles(colors).ink },
  group: { paddingTop: 10, paddingBottom: 6 },
  subtitle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  check: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
}))
