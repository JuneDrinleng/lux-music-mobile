/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { ScrollView, View } from 'react-native'
import { MagDialog, StatusChip } from '@/components/magazine'
import Text from '@/components/common/Text'
import ChangelogView from '@/components/ChangelogView'
import { useI18n } from '@/lang'
import { useVersionDownloadProgressUpdated, useVersionInfo } from '@/store/version/hook'
import { downloadUpdate, hideModal, setIgnoreVersion } from '@/core/version'
import { isDevBuild } from '@/utils/releaseChannel'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'

const currentVer = process.versions.app

const VersionModal = ({ componentId }: { componentId: string }) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const t = useI18n()
  const versionInfo = useVersionInfo()
  const progress = useVersionDownloadProgressUpdated()

  const handleIgnore = () => {
    if (!versionInfo.newVersion) return
    setIgnoreVersion(versionInfo.newVersion.version)
    hideModal(componentId)
  }

  const handleConfirm = () => {
    if (!versionInfo.newVersion) return
    hideModal(componentId)
    downloadUpdate()
  }

  const nextVersion = versionInfo.newVersion?.version ?? '-'
  const nextIsDev = nextVersion != '-' && isDevBuild(nextVersion)
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.current / progress.total) * 100)) : 0
  const downloading = versionInfo.status === 'downloading' || versionInfo.status === 'downloaded'

  return (
    <View style={styles.fill}>
      <MagDialog
        visible
        embedded
        bgHide={false}
        onClose={handleIgnore}
        eyebrow={t('version_modal_eyebrow')}
        title=""
        cancelLabel={t('version_btn_ignore')}
        confirmLabel={t('version_btn_new')}
        onCancel={handleIgnore}
        onConfirm={handleConfirm}
      >
        <View style={styles.versionRow}>
          <Text size={magType.h1.size} color={r.display} style={styles.version}>{nextVersion}</Text>
          {nextIsDev ? <StatusChip label={t('setting_release_channel_dev')} small /> : null}
        </View>
        <Text size={13} color={r.muted} style={styles.meta}>
          {t('version_modal_current_meta', { version: currentVer })}
        </Text>
        {versionInfo.newVersion?.desc
          ? (
            <ScrollView style={styles.descScroll} nestedScrollEnabled>
              <ChangelogView desc={versionInfo.newVersion.desc} compact />
            </ScrollView>
            )
          : null}
        {downloading && progress.total > 0
          ? (
            <View style={styles.progressBlock}>
              <View style={styles.progressLabels}>
                <Text size={12} color={r.muted}>{t('version_btn_downloading', { current: progress.current, total: progress.total, progress: pct })}</Text>
                <Text size={12} color={r.muted}>{pct}%</Text>
              </View>
              <View style={[styles.track, { backgroundColor: r.hairline }]}>
                <View style={[styles.fillBar, { backgroundColor: r.ink, width: `${pct}%` }]} />
              </View>
            </View>
            )
          : null}
      </MagDialog>
    </View>
  )
}

const useStyles = sharedLuxStyles(() => createStyle({
  fill: { flex: 1 },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: -6,
  },
  version: {
    fontWeight: '800',
    letterSpacing: -1,
  },
  meta: {
    marginTop: 6,
    marginBottom: 10,
  },
  descScroll: {
    maxHeight: 220,
  },
  progressBlock: {
    marginTop: 14,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  track: {
    height: 2,
    width: '100%',
    overflow: 'hidden',
  },
  fillBar: {
    height: 4,
    marginTop: -1,
  },
}))

export default VersionModal
