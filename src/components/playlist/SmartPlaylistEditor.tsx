/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useSettingsTransition } from '@/components/common/SettingsPage'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Animated, FlatList, Modal, ScrollView, TouchableOpacity, View } from 'react-native'
import { SubpageSurface } from '@/components/common/SubpageSurface'
import { FocusVisibleScrollView, FocusVisibleAction } from '@/components/common/FocusVisibleScrollView'
import Text from '@/components/common/Text'
import { MagTopBar, MagazineSheet, OptionRow, Toggle, PrimaryButton, TextButton, UnderlineInput, MagSegmented } from '@/components/magazine'
import { useLuxTheme, sharedLuxStyles } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'
import useSystemGestureInsetBottom from '@/utils/hooks/useSystemGestureInsetBottom'
import { fieldOperators, isRuleSet, type Rule, type RuleField, type SmartPlaylistDefinition } from '@/utils/smartPlaylist/model'
import { previewSmartPlaylist, saveSmartPlaylist } from '@/utils/smartPlaylist'
import { getActiveSpace } from '@/utils/dataSpace'

// Rule fields and values are selected together by this form.
/* eslint-disable @typescript-eslint/consistent-type-assertions */
const defaultRule = (field: RuleField): Rule => ({ field, operator: fieldOperators[field][0], value: field == 'liked' ? true : ['artist', 'title', 'album'].includes(field) ? '' : field == 'source' ? 'wy' : field == 'lastPlayed' || field == 'addedDate' ? Date.now() : 5 } as Rule)
export const newSmartPlaylist = (name: string): SmartPlaylistDefinition => ({
  playlistId: `userlist_smart_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  name,
  autoRefresh: true,
  ruleSet: { match: 'all', rules: [{ field: 'playCount', operator: 'gte', value: 5 }, { field: 'lastPlayed', operator: 'withinDays', value: 30 }, { field: 'source', operator: 'notEquals', value: 'mg' }, { field: 'artist', operator: 'contains', value: '周杰伦' }], sort: { field: 'playCount', direction: 'desc' }, limit: 50 },
})

type Picker = { kind: 'field' | 'operator' | 'value', index: number } | { kind: 'sort' | 'preview' }
export default ({ initial, onClose: finishClose }: { initial: SmartPlaylistDefinition, onClose: () => void }) => {
  const { style: pageStyle, requestClose } = useSettingsTransition()
  const onClose = useCallback(() => { requestClose(finishClose) }, [requestClose, finishClose])
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const styles = useStyles()
  const status = useStatusbarHeight()
  const inset = useSystemGestureInsetBottom()
  const [draft, setDraft] = useState(initial)
  const [picker, setPicker] = useState<Picker | null>(null)
  const [value, setValue] = useState('')
  const [result, setResult] = useState<{ matchCount: number, songs: LX.Music.MusicInfo[] } | null>(null)
  const [error, setError] = useState(false)
  const [saving, setSaving] = useState(false)
  const space = useRef(getActiveSpace()).current
  const valid = !!draft.name.trim() && isRuleSet(draft.ruleSet)
  const label = (key: string) => t(`smart_${key}` as Parameters<typeof t>[0])
  const changeRules = (rules: Rule[]) => { setDraft(prev => ({ ...prev, ruleSet: { ...prev.ruleSet, rules } })) }
  const changeRule = (index: number, rule: Rule) => { changeRules(draft.ruleSet.rules.map((old, i) => i == index ? rule : old)) }
  useEffect(() => {
    let active = true
    setResult(null)
    setError(false)
    if (!isRuleSet(draft.ruleSet)) return
    const timer = setTimeout(() => {
      void previewSmartPlaylist(draft.ruleSet, () => { if (!active || getActiveSpace() != space) throw Error('Cancelled') }).then(next => {
        if (active) setResult(next)
      }).catch(() => { if (active) setError(true) })
    }, 250)
    return () => { active = false; clearTimeout(timer) }
  }, [draft.ruleSet, space])
  const save = async() => {
    if (!valid || saving || getActiveSpace() != space) return
    setSaving(true)
    try { await saveSmartPlaylist(draft); onClose() } catch { setError(true); setSaving(false) }
  }
  const rule = picker && 'index' in picker ? draft.ruleSet.rules[picker.index] : null
  const openValue = (index: number) => {
    const item = draft.ruleSet.rules[index]
    setValue(item.operator == 'before' || item.operator == 'after' ? new Date(Number(item.value)).toISOString().slice(0, 10) : String(item.value))
    setPicker({ kind: 'value', index })
  }
  const applyValue = () => {
    if (!picker || !('index' in picker) || !rule) return
    const next = rule.operator == 'before' || rule.operator == 'after' ? Date.parse(value) : typeof rule.value == 'number' ? Number(value) : value
    if (typeof next == 'number' && (!Number.isFinite(next) || next < 0)) return
    changeRule(picker.index, { ...rule, value: next } as Rule)
    setPicker(null)
  }
  const valueLabel = (item: Rule) => {
    if (item.field == 'liked') return label(item.value ? 'yes' : 'no')
    if (item.operator == 'before' || item.operator == 'after') return new Date(Number(item.value)).toISOString().slice(0, 10)
    return `${item.value}${item.field == 'playCount' ? label('times') : item.operator == 'withinDays' || item.operator == 'notWithinDays' ? label('days') : item.field == 'duration' ? label('seconds') : ''}`
  }
  const pill = (text: string, action: () => void, accessibilityLabel = text) => <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }} style={styles.pill} onPress={action}><Text size={13} color={r.ink} numberOfLines={1} style={{ fontWeight: '700' }}>{text}</Text></TouchableOpacity>
  return <Modal transparent visible animationType="none" onRequestClose={onClose}><Animated.View style={[{ flex: 1 }, pageStyle]}>
    <SubpageSurface coversDock style={[styles.root, { paddingTop: status }]}>
      <FocusVisibleScrollView contentContainerStyle={styles.page}>
        <MagTopBar onBack={onClose} trailing={<FocusVisibleAction><TextButton compact label={label('save')} disabled={!valid || saving} onPress={() => { void save() }} /></FocusVisibleAction>} />
        <Text size={11} color={r.eyebrow} style={styles.eyebrow}>{label('eyebrow')}</Text>
        <UnderlineInput accessibilityLabel={label('name')} value={draft.name} onChangeText={name => { setDraft(prev => ({ ...prev, name })) }} style={styles.name} />
        <View style={styles.rule} />
        <View style={styles.heading}><Text size={22} color={r.ink} style={{ fontWeight: '800' }}>{label('rules')}</Text><MagSegmented compact items={[{ id: 'all', label: label('all') }, { id: 'any', label: label('any') }]} value={draft.ruleSet.match} onChange={match => { setDraft(prev => ({ ...prev, ruleSet: { ...prev.ruleSet, match: match as 'all' | 'any' } })) }} /></View>
        {draft.ruleSet.rules.map((item, index) => <View key={index} style={styles.row}>
          <TouchableOpacity style={styles.field} hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }} accessibilityRole="button" onPress={() => { setPicker({ kind: 'field', index }) }}><Text size={15} color={r.list} style={{ fontWeight: '700' }}>{label(item.field)}</Text></TouchableOpacity>
          {pill(`${label(item.operator)} ▾`, () => { setPicker({ kind: 'operator', index }) })}
          <View style={{ flexShrink: 1 }}>{pill(valueLabel(item) || label('value'), () => { openValue(index) })}</View>
          <View style={{ flex: 1 }} />
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={label('remove')} hitSlop={12} onPress={() => { changeRules(draft.ruleSet.rules.filter((_, i) => i != index)) }}><Text size={16} color={r.muted}>×</Text></TouchableOpacity>
        </View>)}
        <View style={styles.row}>{pill(label('add'), () => { if (draft.ruleSet.rules.length < 100) setPicker({ kind: 'field', index: draft.ruleSet.rules.length }) })}</View>
        <View style={styles.rule} />
        <TouchableOpacity style={styles.row} accessibilityRole="button" onPress={() => { setPicker({ kind: 'sort' }) }}><View style={{ flex: 1 }}><Text size={15} color={r.list} style={{ fontWeight: '700' }}>{label('sort')}</Text><Text size={12} color={r.muted} style={{ marginTop: 2 }}>{t(draft.ruleSet.sort.direction == 'asc' ? 'smart_sort_summary_asc' : 'smart_sort_summary', { field: label(draft.ruleSet.sort.field) })} · {draft.ruleSet.limit == null ? t('smart_limit_none') : t('smart_limit_summary', { num: draft.ruleSet.limit })}</Text></View><Text color={r.ink}>›</Text></TouchableOpacity>
        <View style={[styles.row, { borderBottomWidth: 0 }]}><View style={{ flex: 1 }}><Text size={15} color={r.list} style={{ fontWeight: '700' }}>{label('auto')}</Text><Text size={12} color={r.muted} style={{ marginTop: 2 }}>{label('auto_hint')}</Text></View><Toggle compact accessibilityLabel={label('auto')} value={draft.autoRefresh} onChange={autoRefresh => { setDraft(prev => ({ ...prev, autoRefresh })) }} /></View>
        {error ? <Text color={r.danger}>{label('error')}</Text> : null}
      </FocusVisibleScrollView>
      <View style={[styles.footer, { paddingBottom: inset + 26 }]}><Text size={12} color={r.muted} style={{ fontWeight: '700' }}>{label('matches')} <Text size={18} color={r.ink} style={{ fontWeight: '800' }}>{result?.matchCount ?? '…'}</Text> {label('songs')}</Text><PrimaryButton compact label={label('preview')} disabled={!result} style={{ flex: 1 }} onPress={() => { setPicker({ kind: 'preview' }) }} /></View>
    </SubpageSurface>
    <MagazineSheet visible={picker != null} onClose={() => { setPicker(null) }} title={label(picker?.kind ?? 'rules')}>
      {picker?.kind == 'preview' ? <FlatList data={result?.songs ?? []} keyExtractor={song => `${song.source}:${song.id}`} renderItem={({ item }) => <View style={styles.row}><View><Text size={15} color={r.list} style={{ fontWeight: '700' }}>{item.name}</Text><Text size={12} color={r.muted}>{item.singer} · {item.source}</Text></View></View>} /> : <ScrollView keyboardShouldPersistTaps="handled">
        {picker?.kind == 'field' ? (Object.keys(fieldOperators) as RuleField[]).map(field => <OptionRow key={field} label={label(field)} selected={rule?.field == field} description={field == 'addedDate' ? label('added_unknown') : undefined} disabled={field == 'addedDate' || (draft.ruleSet.rules.length >= 100 && picker.index == draft.ruleSet.rules.length)} onPress={() => { const next = defaultRule(field); if (picker.index == draft.ruleSet.rules.length) changeRules([...draft.ruleSet.rules, next]); else changeRule(picker.index, next); setPicker(null) }} />) : null}
        {picker?.kind == 'operator' && rule ? fieldOperators[rule.field].map(operator => <OptionRow key={operator} label={label(operator)} selected={operator == rule.operator} onPress={() => { changeRule(picker.index, { ...rule, operator, value: operator == 'withinDays' || operator == 'notWithinDays' ? 30 : operator == 'before' || operator == 'after' ? Date.now() : rule.value } as Rule); setPicker(null) }} />) : null}
        {picker?.kind == 'value' && rule ? rule.field == 'liked' ? [true, false].map(next => <OptionRow key={String(next)} label={label(next ? 'yes' : 'no')} selected={rule.value == next} onPress={() => { changeRule(picker.index, { ...rule, value: next } as Rule); setPicker(null) }} />) : <View><UnderlineInput accessibilityLabel={label('value')} label={rule.operator == 'before' || rule.operator == 'after' ? label('date_hint') : label('value')} value={value} onChangeText={setValue} keyboardType={typeof rule.value == 'number' && rule.operator != 'before' && rule.operator != 'after' ? 'numeric' : 'default'} autoFocus /><PrimaryButton compact label={label('apply')} onPress={applyValue} style={{ marginTop: 20 }} /></View> : null}
        {picker?.kind == 'sort' ? <View>{(['library', ...Object.keys(fieldOperators)] as const).map(field => <OptionRow key={field} label={label(field)} selected={draft.ruleSet.sort.field == field} disabled={field == 'addedDate'} onPress={() => { setDraft(prev => ({ ...prev, ruleSet: { ...prev.ruleSet, sort: { ...prev.ruleSet.sort, field: field as RuleField | 'library' } } })) }} />)}{(['asc', 'desc'] as const).map(direction => <OptionRow key={direction} label={label(direction)} selected={draft.ruleSet.sort.direction == direction} onPress={() => { setDraft(prev => ({ ...prev, ruleSet: { ...prev.ruleSet, sort: { ...prev.ruleSet.sort, direction } } })) }} />)}<UnderlineInput label={label('limit')} value={draft.ruleSet.limit == null ? '' : String(draft.ruleSet.limit)} keyboardType="numeric" onChangeText={text => { setDraft(prev => ({ ...prev, ruleSet: { ...prev.ruleSet, limit: text ? Number(text) : undefined } })) }} /></View> : null}
      </ScrollView>}
    </MagazineSheet>
  </Animated.View></Modal>
}
const useStyles = sharedLuxStyles(colors => {
  const r = magazineRoles(colors)
  return createStyle({
    root: { flex: 1, backgroundColor: r.paper },
    page: { paddingHorizontal: 22, paddingBottom: 30 },
    eyebrow: { marginTop: 6, fontWeight: '700', letterSpacing: 2 },
    name: { fontSize: 32, lineHeight: 38, fontWeight: '800', color: r.display, paddingVertical: 0, borderBottomWidth: 0 },
    rule: { height: 2, backgroundColor: r.ink, marginTop: 22, marginBottom: 12 },
    heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: r.hairline },
    field: { width: 80 },
    pill: { height: 28, borderWidth: 1.5, borderColor: r.ink, borderRadius: 15, paddingHorizontal: 14, justifyContent: 'center', maxWidth: 145 },
    footer: { marginTop: 'auto', paddingHorizontal: 22, paddingTop: 20, borderTopWidth: 2, borderTopColor: r.ink, flexDirection: 'row', alignItems: 'center', gap: 16 },
  })
})
