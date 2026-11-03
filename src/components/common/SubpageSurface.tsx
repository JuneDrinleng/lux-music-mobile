/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { KeyboardAvoidingView, Platform, type ViewProps } from 'react-native'
import { useLuxTheme } from '@/theme/LuxTheme'
import { VisibleDockHeightContext, useVisibleDockHeight } from './VisibleDockHeight'

/** All depths below a Tab: opaque background and one reservation above the visible Dock.
 * Native full-screen Modals cover the Dock themselves: pass coversDock.
 * SettingsPage already clips its host; nested surfaces inherit zero reservation.
 */
export function SubpageSurface({ coversDock = false, style, children, ...props }: ViewProps & { coversDock?: boolean }) {
  const { colors } = useLuxTheme()
  const dockHeight = useVisibleDockHeight()
  return <KeyboardAvoidingView enabled={coversDock && Platform.OS === 'ios'} behavior="padding" {...props} style={[{ flex: 1, backgroundColor: colors.bg.app }, style, { paddingBottom: coversDock ? 0 : dockHeight }]}>
    <VisibleDockHeightContext.Provider value={0}>{children}</VisibleDockHeightContext.Provider>
  </KeyboardAvoidingView>
}
