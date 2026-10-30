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
  OptionRow,
  TextButton,
} from '@/components/magazine'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'
import { setSyncMode } from '@/utils/data'
import { enterLocalSpace } from '@/utils/enterLocalSpace'
import { completeOnboarding } from '@/utils/onboarding'
import ServerStep from './ServerStep'
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
  const [step, setStep] = useState(1)
  const [mode, setMode] = useState<'local' | 'lux'>('lux')
  const [message, setMessage] = useState('')
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

    setStep(2)
    setConfirming(false)
  }, [allRequiredChecked, confirming])

  const finishLocal = async() => {
    if (confirming) return
    setConfirming(true)
    try {
      await enterLocalSpace(t('sync_login_local_user_name'))
      await setSyncMode('lux')
      await completeOnboarding()
      await navigations.pushHomeScreen()
      global.lx.isShowingLaunchScreen = false
      void global.lx._onLoginConfirmed?.()
    } catch (error) {
      setMessage(String(error))
      setConfirming(false)
    }
  }

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (!confirming) setStep(current => Math.max(1, current - 1)); return true })
    return () => { subscription.remove() }
  }, [confirming])

  if (step === 3) return <ServerStep onBack={() => { setStep(2) }} />

  return (
    <View style={[styles.container, { backgroundColor: r.paper, paddingTop: statusBarHeight }]}>
      <StatusBar />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progress} accessibilityLabel={t('onboard_step', { step })}>
          {[1, 2, 3].map(segment => <View key={segment} style={[styles.segment, { backgroundColor: segment <= step ? r.ink : r.hairline }]} />)}
        </View>
        <Text size={11} color={r.eyebrow} style={styles.stepLabel}>{t('onboard_step', { step })}</Text>
        {step === 2 ? <>
          <Text size={32} color={r.display} style={styles.modeTitle}>{t('onboard_mode_title')}</Text>
          <OptionRow leading label={t('onboard_local')} description={t('onboard_local_desc')} selected={mode === 'local'} onPress={() => { setMode('local') }} />
          <OptionRow leading label={t('onboard_lux')} description={t('onboard_lux_desc')} selected={mode === 'lux'} onPress={() => { setMode('lux') }} />
          <Text size={12} color={r.muted} style={styles.help}>{t('onboard_server_help')}</Text>
          {message ? <Text size={12} color={r.danger}>{message}</Text> : null}
        </> : <>
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
        </>}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: r.ink }]}>
        {step === 2 ? <TextButton label={t('onboard_previous')} underline={false} disabled={confirming} onPress={() => { setStep(1) }} /> : null}
        <PrimaryButton
          compact
          style={styles.next}
          label={step === 1 ? t('onboard_next_mode') : mode === 'lux' ? t('onboard_next_server') : t('onboard_finish_local')}
          onPress={() => {
            if (step === 1) void handleConfirm()
            else if (mode === 'lux') setStep(3)
            else void finishLocal()
          }}
          disabled={confirming || (step === 1 && !allRequiredChecked)}
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
    paddingTop: 20,
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
  progress: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 3 },
  stepLabel: { marginTop: 14, letterSpacing: 2, fontWeight: '700' },
  modeTitle: { marginTop: 6, fontWeight: '800', lineHeight: 38 },
  help: { marginTop: 22 },
  next: { flex: 1 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 76,
    borderTopWidth: 2,
    paddingHorizontal: PAGE_GUTTER,
    paddingBottom: 26,
    paddingTop: 12,
  },
}))
