import { memo } from 'react'
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native'
import { Navigation } from 'react-native-navigation'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import LanguageSwitch from '@/components/common/LanguageSwitch'
import StatusBar from '@/components/common/StatusBar'
import { useTheme } from '@/store/theme/hook'
import { useStatusbarHeight } from '@/store/common/hook'
import { scaleSizeH, scaleSizeW } from '@/utils/pixelRatio'
import { HEADER_HEIGHT } from '@/config/constant'
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

const SCALED_HEADER_HEIGHT = scaleSizeH(HEADER_HEIGHT)

const Agreement = ({ componentId, mode = 'push', docType = 'pact' }: AgreementProps) => {
  const theme = useTheme()
  const t = useI18n()
  const statusBarHeight = useStatusbarHeight()
  const isOverlay = mode === 'overlay'
  const topPadding = statusBarHeight + scaleSizeH(24)
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
    <View style={[styles.container, { backgroundColor: theme['c-content-background'] }]}>
      <View style={[styles.topBarOuter, { paddingTop: topPadding, height: SCALED_HEADER_HEIGHT + topPadding, backgroundColor: theme['c-main-background'], borderBottomColor: theme['c-border-background'] }]}>
        <StatusBar />
        <View style={[styles.topBar, { paddingBottom: 4 }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
            <Icon name="chevron-left" size={18} color={theme['c-primary']} />
            <Text color={theme['c-primary']} size={15}>{isOverlay ? t('close') : t('back')}</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle} size={17}>{title}</Text>
          <View style={styles.backBtn} />
        </View>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.languageSwitch}>
          <LanguageSwitch />
        </View>
        {sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle} size={16}>{section.title}</Text>
            <Text style={styles.sectionBody} color={theme['c-600']} size={14}>
              {section.body}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  )
}

export default memo(Agreement)

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBarOuter: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scaleSizeW(4),
  },
  topBarTitle: {
    fontWeight: '600',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: scaleSizeW(80),
    height: '100%',
    paddingLeft: scaleSizeW(12),
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: scaleSizeW(20),
    paddingTop: scaleSizeH(20),
    paddingBottom: scaleSizeH(32),
  },
  languageSwitch: {
    alignItems: 'center',
    marginBottom: scaleSizeH(22),
  },
  section: {
    marginBottom: scaleSizeH(22),
  },
  sectionTitle: {
    fontWeight: '600',
    marginBottom: scaleSizeH(8),
  },
  sectionBody: {
    lineHeight: 22,
  },
})
