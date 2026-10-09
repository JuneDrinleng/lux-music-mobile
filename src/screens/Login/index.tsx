/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { BackHandler, ScrollView, TouchableOpacity, View } from 'react-native'
import LanguageSwitch from '@/components/common/LanguageSwitch'
import StatusBar from '@/components/common/StatusBar'
import Text from '@/components/common/Text'
import {
  Checkbox,
  Hairline,
  PrimaryButton,
  RankNumber,
  Rule,
} from '@/components/magazine'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'
import { storageDataPrefix } from '@/config/constant'
import { saveData } from '@/plugins/storage'
import { updateSetting } from '@/core/common'
import { navigations } from '@/navigation'
import { pushAgreementScreen } from '@/navigation/navigation'
import { useI18n } from '@/lang'
import { useStatusbarHeight } from '@/store/common/hook'

const itemKeys = ['pact', 'cheatTip', 'freeOpenSource'] as const

export default memo(({ componentId }: { componentId: string }) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [confirming, setConfirming] = useState(false)

  const items = useMemo(() => itemKeys.map(key => ({ key, required: true })), [])

  const allRequiredChecked = useMemo(() =>
    items.every(item => !item.required || (checked[item.key] ?? false)),
  [checked, items])

  const handleToggle = useCallback((key: string) => {
    setChecked(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleConfirm = useCallback(async() => {
    if (!allRequiredChecked || confirming) return
    setConfirming(true)

    if (checked.cheatTip) {
      await saveData(storageDataPrefix.cheatTip, true)
    }
    if (checked.pact) {
      updateSetting({ 'common.isAgreePact': true })
    }
    if (checked.freeOpenSource) {
      // acknowledgement only — no persisted flag beyond the two above
    }

    await navigations.pushSyncLoginScreen()
  }, [allRequiredChecked, confirming, checked])

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true)
    return () => { subscription.remove() }
  }, [])

  return (
    <View style={[styles.container, { backgroundColor: r.paper, paddingTop: statusBarHeight }]}>
      <StatusBar />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.eyebrow}>
            {t('welcome_eyebrow')}
          </Text>
          <LanguageSwitch />
        </View>

        <View style={[styles.mark, { backgroundColor: r.ink }]}>
          <Text size={28} color={r.accent} style={styles.markLetter}>L</Text>
        </View>

        <Text size={magType.h2.size} color={r.display} style={styles.title}>{t('welcome_title')}</Text>
        <Text size={15} color={r.muted} style={styles.lead}>{t('login_freeOpenSource_desc')}</Text>

        <Rule compact gapTop={22} />

        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          onPress={() => {
            handleToggle('pact')
            pushAgreementScreen(componentId, 'pact')
          }}
        >
          <RankNumber rank={1} />
          <View style={styles.rowText}>
            <Text size={16} color={r.ink} style={styles.rowTitle}>{t('agreement_pact_title')}</Text>
            <Text size={12} color={r.muted} style={styles.rowDesc}>{t('welcome_pact_desc')}</Text>
          </View>
          <Checkbox checked={!!checked.pact} onChange={() => { handleToggle('pact') }} />
        </TouchableOpacity>
        <Hairline />

        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          onPress={() => {
            handleToggle('cheatTip')
            pushAgreementScreen(componentId, 'cheat-tip')
          }}
        >
          <RankNumber rank={2} />
          <View style={styles.rowText}>
            <Text size={16} color={r.ink} style={styles.rowTitle}>{t('agreement_cheat_tip_title')}</Text>
            <Text size={12} color={r.muted} style={styles.rowDesc}>{t('welcome_cheat_desc')}</Text>
          </View>
          <Checkbox checked={!!checked.cheatTip} onChange={() => { handleToggle('cheatTip') }} />
        </TouchableOpacity>
        <Hairline />

        <TouchableOpacity
          style={styles.acceptRow}
          activeOpacity={0.75}
          onPress={() => { handleToggle('freeOpenSource') }}
        >
          <Checkbox checked={!!checked.freeOpenSource} onChange={() => { handleToggle('freeOpenSource') }} />
          <Text size={15} color={r.ink} style={styles.acceptLabel}>{t('login_freeOpenSource_label')}</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label={t('welcome_next')}
          onPress={() => { void handleConfirm() }}
          disabled={!allRequiredChecked || confirming}
          icon="arrow-right"
        />
      </View>
    </View>
  )
})

const useStyles = sharedLuxStyles(() => createStyle({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PAGE_GUTTER,
    paddingBottom: 28,
    paddingTop: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  markLetter: {
    fontWeight: '800',
  },
  title: {
    fontWeight: '800',
    letterSpacing: -0.8,
    marginBottom: 10,
  },
  lead: {
    lineHeight: 22,
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontWeight: '700',
  },
  rowDesc: {
    marginTop: 4,
    lineHeight: 17,
  },
  acceptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    minHeight: 44,
  },
  acceptLabel: {
    flex: 1,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: PAGE_GUTTER,
    paddingBottom: 28,
    paddingTop: 12,
  },
}))
