/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useMemo, useRef, useState } from 'react'
import { FlatList, TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { MagazineSheet, PrimaryButton, TextButton } from '@/components/magazine'
import { useI18n } from '@/lang'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { formatPlayTime2 } from '@/utils/common'
import { clearShareLines, describeSelection, openLineSelection, selectedShareLines, toggleShareLine, type ShareLine } from '@/utils/shareCard/selection'
import { createStyle, toast } from '@/utils/tools'

const useStyles = sharedLuxStyles(() => createStyle({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, borderBottomWidth: 1 },
  checkbox: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, paddingVertical: 6 },
  title: { fontWeight: '700' },
  timestamp: { marginTop: 2 },
  footer: { borderTopWidth: 2, marginHorizontal: -22, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26, flexDirection: 'row', alignItems: 'center', gap: 16 },
  primary: { flex: 1, gap: 8 },
}))

/** Open from a selected lyric row; parent identity invalidates the sheet on track/revision changes. */
export const LyricSelectionSheet = ({ source, lines, initialIndex, song, onClose, onGenerate }: {
  source: string
  lines: readonly ShareLine[]
  initialIndex: number
  song: string
  onClose: () => void
  onGenerate: (lines: ShareLine[]) => void
}) => {
  const styles = useStyles()
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const [selection, setSelection] = useState(() => openLineSelection(source, lines, initialIndex))
  const summary = describeSelection(selection)
  const rows = useMemo(() => lines.map((line, index) => ({ ...line, index })).filter(line => line.text.trim()), [lines])
  const listRef = useRef<FlatList<ShareLine & { index: number }>>(null)
  const meta = t('share_card_select_summary', { first: summary.first == null ? '—' : String(summary.first).padStart(2, '0'), last: summary.last == null ? '—' : String(summary.last).padStart(2, '0'), kind: t(summary.contiguous ? 'share_card_contiguous' : 'share_card_separate') })
  return (
    <MagazineSheet visible heightRatio={620 / 844} onClose={onClose}
      eyebrow={t('share_card_select_eyebrow', { song })} title={t('share_card_select_title')}
      figure={{ value: String(summary.count), unit: t('share_card_select_unit') }} meta={meta}
      headerAction={{ text: t('share_card_clear'), onPress: () => { setSelection(clearShareLines(selection)) } }}
      lyricLayout
      footerContent={<View style={[styles.footer, { borderTopColor: r.ink }]}><TextButton compact labelSize={16} label={t('cancel')} underline={false} onPress={onClose} /><PrimaryButton compact style={styles.primary} badge={summary.count} badgeStyle={{ height: 18 }} label={t('share_card_generate')} disabled={!summary.count} onPress={() => { onGenerate(selectedShareLines(selection, source, lines)) }} /></View>}
    >
      <FlatList ref={listRef} data={rows} keyExtractor={item => String(item.index)} extraData={selection} showsVerticalScrollIndicator={false}
        initialScrollIndex={Math.max(0, rows.findIndex(row => row.index === initialIndex) - 2)}
        onScrollToIndexFailed={({ index, averageItemLength }) => { listRef.current?.scrollToOffset({ offset: index * averageItemLength, animated: false }) }}
        renderItem={({ item }) => {
          const checked = selection.indices.includes(item.index)
          return <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={`${item.text} ${formatPlayTime2(item.time / 1000)}`} activeOpacity={0.7} style={[styles.row, { borderBottomColor: r.hairline, borderBottomWidth: item.index === rows[rows.length - 1]?.index ? 0 : 1 }]} onPress={() => {
            const result = toggleShareLine(selection, source, lines, item.index)
            if (result.error === 'limit') toast(t('share_card_limit'))
            setSelection(result.selection)
          }}>
            <View style={[styles.checkbox, { borderColor: r.ink, backgroundColor: checked ? r.ink : r.paper }]}><Text size={13} color={r.onInk}>{checked ? '✓' : ''}</Text></View>
            <View style={styles.text}><Text size={15} color={r.list} style={[styles.title, checked ? { fontWeight: '800' } : null]}>{item.text}</Text><Text size={12} color={r.muted} style={styles.timestamp}>{formatPlayTime2(item.time / 1000)}</Text></View>
          </TouchableOpacity>
        }} />
    </MagazineSheet>
  )
}
