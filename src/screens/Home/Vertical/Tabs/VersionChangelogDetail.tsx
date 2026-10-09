/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useMemo, useState } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import ChangelogView from '@/components/ChangelogView'
import { OptionRow, SectionHeader, SettingRow, StatusChip } from '@/components/magazine'
import { useI18n } from '@/lang'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'
import { loadInstalledChangelog, readBundledChangelog, type InstalledChangelog } from '@/utils/installedChangelog'
import { isDevBuild, type ReleaseChannel } from '@/utils/releaseChannel'
import { openUrl } from '@/utils/tools'

const releaseNotesUrl = (version: string) => `https://github.com/JuneDrinleng/lux-music-mobile/releases/tag/v${version}`

interface VersionChangelogDetailProps {
  styles?: Record<string, unknown>
  version: string
  releaseChannel: ReleaseChannel
  onSelectReleaseChannel: (value: ReleaseChannel) => void
}

export default ({ version, releaseChannel, onSelectReleaseChannel }: VersionChangelogDetailProps) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
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
    <View>
      <SectionHeader title={t('version_current_info')} meta="VERSION" showRule={false} />
      <View style={{ marginTop: 8, marginBottom: 16, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text size={magType.h2.size} color={r.display} style={{ fontWeight: '800' }}>{version}</Text>
          <StatusChip label={channelLabel} />
        </View>
        {entry?.date
          ? <Text size={13} color={r.muted}>{t('version_changelog_date')}{entry.date}</Text>
          : null}
      </View>

      <SectionHeader title={t('setting_release_channel')} meta="CHANNEL" />
      <OptionRow
        label={t('setting_release_channel_stable')}
        selected={releaseChannel == 'stable'}
        onPress={() => { onSelectReleaseChannel('stable') }}
      />
      <OptionRow
        label={t('setting_release_channel_dev')}
        selected={releaseChannel == 'dev'}
        onPress={() => { onSelectReleaseChannel('dev') }}
        last
      />

      <SectionHeader title={t('version_changelog_title')} meta="NOTES" />
      <View style={{ paddingVertical: 8 }}>
        {entry
          ? <ChangelogView desc={entry.desc} />
          : (
            <Text size={15} color={r.muted} style={{ lineHeight: 22 }}>
              {loading ? t('version_changelog_loading') : t('version_changelog_empty')}
            </Text>
            )}
      </View>
      <SettingRow
        icon="github"
        iconBg={r.iconWrap.amber}
        title={t('version_changelog_github')}
        onPress={handleOpenGithub}
        last
      />
    </View>
  )
}
