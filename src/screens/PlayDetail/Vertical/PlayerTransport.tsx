/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, type ReactNode } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'

import SeekBar from './components/SeekBar'
import { PLAYER_ICON_TAP } from './PlayerChrome'
import { PLAYER_TRANSPORT } from './playerTransportLayout'

/**
 * Pinned bottom transport: seek bar, time labels, and a control row.
 * Play (vinyl) and lyric pages must use this so the dock Y cannot drift.
 */
export const PlayerTransport = memo(({
  progress,
  duration,
  nowPlayTimeStr,
  maxPlayTimeStr,
  children,
}: {
  progress: number
  duration: number
  nowPlayTimeStr: string
  maxPlayTimeStr: string
  children: ReactNode
}) => {
  const styles = useStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <View style={[styles.panel, { backgroundColor: r.paper }]}>
      <SeekBar progress={progress} duration={duration} />
      <View style={styles.timeRow}>
        <Text size={11} color={r.faint} style={styles.timeText}>{nowPlayTimeStr}</Text>
        <Text size={11} color={r.faint} style={styles.timeText}>{maxPlayTimeStr}</Text>
      </View>
      <View style={styles.footer}>{children}</View>
    </View>
  )
})

export const playerTransportControlStyles = {
  iconBtn: {
    width: PLAYER_ICON_TAP,
    height: PLAYER_ICON_TAP,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  playBtn: {
    width: PLAYER_TRANSPORT.playBtn,
    height: PLAYER_TRANSPORT.playBtn,
    borderRadius: PLAYER_TRANSPORT.playBtn / 2,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
}

const useStyles = sharedLuxStyles(() => createStyle({
  panel: {
    paddingHorizontal: PLAYER_TRANSPORT.paddingHorizontal,
    paddingTop: PLAYER_TRANSPORT.paddingTop,
    paddingBottom: PLAYER_TRANSPORT.paddingBottom,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: PLAYER_TRANSPORT.timeMarginBottom,
  },
  timeText: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
}))
