/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useMemo, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'

import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import ChangelogView from '@/components/ChangelogView'
import { useI18n } from '@/lang'
import { createStyle, openUrl } from '@/utils/tools'
import { isDevBuild, type ReleaseChannel } from '@/utils/releaseChannel'
import { loadInstalledChangelog, readBundledChangelog, type InstalledChangelog } from '@/utils/installedChangelog'

const releaseNotesUrl = (version: string) => `https://github.com/JuneDrinleng/lux-music-mobile/releases/tag/v${version}`

interface VersionChangelogDetailProps {
  styles: Record<string, any>
  version: string
  releaseChannel: ReleaseChannel
  onSelectReleaseChannel: (value: ReleaseChannel) => void
}

export default ({ styles: parentStyles, version, releaseChannel, onSelectReleaseChannel }: VersionChangelogDetailProps) => {
  const t = useI18n()
  const bundled = useMemo(() => readBundledChangelog(version), [version])
  const [remote, setRemote] = useState<InstalledChangelog | null>(null)
  const [loading, setLoading] = useState(bundled == null)

  useEffect(() => {
    if (bundled) return
    let cancelled = false
    setLoading(true)
    void loadInstalledChangelog(version).then(result => {
      if (cancelled) return
      setRemote(result)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [bundled, version])

  const entry = bundled ?? remote
  const channel = entry?.channel ?? (isDevBuild(version) ? 'dev' : 'stable')
  const channelLabel = channel == 'dev'
    ? t('setting_release_channel_dev')
    : t('setting_release_channel_stable')
  const handleOpenGithub = () => {
    void openUrl(releaseNotesUrl(version))
  }

  return (
    <>
      <View style={parentStyles.optionDetailRow}>
        <View style={styles.meta}>
          <Text size={20} color="#1a1c1e" style={parentStyles.profileDetailTitle}>{version}</Text>
          <Text size={13} color="#767d89">{channelLabel}</Text>
          {entry?.date
            ? <Text size={13} color="#767d89">{t('version_changelog_date')}{entry.date}</Text>
            : null}
        </View>
      </View>
      <View style={parentStyles.optionDetailDivider} />
      <View style={styles.channelLabelRow}>
        <Text size={13} color="#767d89">{t('setting_release_channel')}</Text>
      </View>
      <TouchableOpacity style={parentStyles.optionDetailRow} activeOpacity={0.84} onPress={() => { onSelectReleaseChannel('stable') }}>
        <Text size={15} color={releaseChannel == 'stable' ? '#20242d' : '#5f6572'} style={parentStyles.optionDetailText}>{t('setting_release_channel_stable')}</Text>
        {releaseChannel == 'stable' ? <View style={parentStyles.languageActiveDot} /> : null}
      </TouchableOpacity>
      <View style={parentStyles.optionDetailDivider} />
      <TouchableOpacity style={parentStyles.optionDetailRow} activeOpacity={0.84} onPress={() => { onSelectReleaseChannel('dev') }}>
        <Text size={15} color={releaseChannel == 'dev' ? '#20242d' : '#5f6572'} style={parentStyles.optionDetailText}>{t('setting_release_channel_dev')}</Text>
        {releaseChannel == 'dev' ? <View style={parentStyles.languageActiveDot} /> : null}
      </TouchableOpacity>
      <View style={parentStyles.optionDetailDivider} />
      <TouchableOpacity style={parentStyles.optionDetailRow} activeOpacity={0.84} onPress={handleOpenGithub}>
        <Text size={15} color="#20242d" style={[parentStyles.optionDetailText, styles.linkText]}>{t('version_changelog_github')}</Text>
        <Icon name="chevron-right-2" rawSize={18} color="#9aa1ae" />
      </TouchableOpacity>
      <View style={parentStyles.optionDetailDivider} />
      <View style={styles.body}>
        {entry
          ? <ChangelogView desc={entry.desc} />
          : <Text size={14} color="#767d89" style={styles.paragraph}>
              {loading ? t('version_changelog_loading') : t('version_changelog_empty')}
            </Text>}
      </View>
    </>
  )
}

const styles = createStyle({
  meta: {
    flex: 1,
    paddingVertical: 4,
  },
  channelLabelRow: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 2,
  },
  body: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  paragraph: {
    lineHeight: 22,
    marginBottom: 8,
  },
  linkText: {
    flex: 1,
    paddingRight: 12,
  },
})
