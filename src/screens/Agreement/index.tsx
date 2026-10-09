/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useState } from 'react'
import { ScrollView, View } from 'react-native'
import { Navigation } from 'react-native-navigation'
import Text from '@/components/common/Text'
import StatusBar from '@/components/common/StatusBar'
import {
  BackButton,
  Hairline,
  PrimaryButton,
  RankNumber,
  TextButton,
  TextTabs,
} from '@/components/magazine'
import { MdiIcon } from '@/components/common/MdiIcon'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PAGE_GUTTER, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'
import { useStatusbarHeight } from '@/store/common/hook'
import { useI18n } from '@/lang'
import type { Message } from '@/lang'

type DocType = 'pact' | 'cheat-tip'

interface AgreementProps {
  componentId: string
  mode?: 'push' | 'overlay'
  docType?: DocType
}

const pactSectionKeys = ['intro', 'source', 'copyright', 'alias', 'resource', 'disclaimer', 'limit', 'copyrightProtection', 'nonCommercial', 'accept'] as const
const cheatTipSectionKeys = ['intro', 'official', 'modified', 'release'] as const

const Agreement = ({ componentId, mode = 'push', docType: initialDocType = 'pact' }: AgreementProps) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const isOverlay = mode === 'overlay'
  const [docType, setDocType] = useState<DocType>(initialDocType)

  const title = docType == 'pact' ? t('agreement_pact_title') : t('agreement_cheat_tip_title')
  const sectionKeyPrefix = docType == 'pact' ? 'agreement_pact' : 'agreement_cheat_tip'
  const sections = (docType == 'pact' ? pactSectionKeys : cheatTipSectionKeys).map(key => ({
    title: t(`${sectionKeyPrefix}_${key}_title` as keyof Message),
    body: t(`${sectionKeyPrefix}_${key}_body` as keyof Message),
  }))

  const handleBack = () => {
    if (isOverlay) {
      void Navigation.dismissOverlay(componentId)
    } else {
      void Navigation.pop(componentId)
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: r.paper, paddingTop: statusBarHeight }]}>
      <StatusBar />
      <View style={styles.topBar}>
        <BackButton onPress={handleBack} accessibilityLabel={isOverlay ? t('close') : t('back')} />
        <TextButton label={t('close')} onPress={handleBack} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text size={magType.eyebrow.size} color={r.eyebrow} style={styles.eyebrow}>
          {docType == 'pact' ? t('agreement_pact_eyebrow') : t('agreement_cheat_eyebrow')}
        </Text>
        <Text size={magType.h2.size} color={r.display} style={styles.title}>{title}</Text>

        <TextTabs
          style={styles.tabs}
          value={docType}
          onChange={(id) => { setDocType(id as DocType) }}
          items={[
            { id: 'pact', label: t('agreement_pact_title') },
            { id: 'cheat-tip', label: t('agreement_cheat_tip_title') },
          ]}
        />

        {sections.map((section, index) => (
          <View key={`${docType}-${index}`}>
            <View style={styles.section}>
              <RankNumber rank={index + 1} width={42} />
              <View style={styles.sectionBody}>
                <Text size={16} color={r.ink} style={styles.sectionTitle}>{section.title}</Text>
                <Text size={14} color={r.muted} style={styles.sectionText}>{section.body}</Text>
              </View>
            </View>
            {index < sections.length - 1 ? <Hairline /> : null}
          </View>
        ))}

        <View style={styles.footnote}>
          <MdiIcon name="information-outline" size={16} color={r.quiet} />
          <Text size={12} color={r.muted} style={styles.footnoteText}>{t('agreement_footnote')}</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label={t('agreement_read_done')} onPress={handleBack} />
      </View>
    </View>
  )
}

export default memo(Agreement)

const useStyles = sharedLuxStyles(() => createStyle({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAGE_GUTTER,
    paddingTop: 10,
    minHeight: 52,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PAGE_GUTTER,
    paddingTop: 8,
    paddingBottom: 28,
  },
  eyebrow: {
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontWeight: '800',
    marginTop: 8,
    letterSpacing: -0.8,
  },
  tabs: {
    marginTop: 22,
    marginBottom: 10,
  },
  section: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 16,
  },
  sectionBody: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionText: {
    lineHeight: 21,
  },
  footnote: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    marginTop: 22,
    paddingTop: 14,
  },
  footnoteText: {
    flex: 1,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: PAGE_GUTTER,
    paddingBottom: 28,
    paddingTop: 10,
  },
}))
