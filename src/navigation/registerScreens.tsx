/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

// @flow

import { Navigation } from 'react-native-navigation'

import {
  Launch,
  Login,
  SyncLogin,
  Agreement,
  Home,
  PlayDetail,
  Comment,
  LeaderboardDetail,
} from '@/screens'
import { Provider } from '@/store/Provider'
import { LuxThemeProvider } from '@/theme/LuxTheme'

import {
  LAUNCH_SCREEN,
  LOGIN_SCREEN,
  SYNC_LOGIN_SCREEN,
  AGREEMENT_SCREEN,
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  COMMENT_SCREEN,
  LEADERBOARD_DETAIL_SCREEN,
  VERSION_MODAL,
  PACT_MODAL,
  SYNC_MODE_MODAL,
} from './screenNames'
import VersionModal from './components/VersionModal'
import PactModal from './components/PactModal'
import SyncModeModal from './components/SyncModeModal'

function WrappedComponent(Component: any) {
  return function inject(props: Record<string, any>) {
    const EnhancedComponent = () => (
      <Provider>
        <LuxThemeProvider>
          <Component
            {...props}
          />
        </LuxThemeProvider>
      </Provider>
    )

    return <EnhancedComponent />
  }
}

export default () => {
  Navigation.registerComponent(LAUNCH_SCREEN, () => WrappedComponent(Launch))
  Navigation.registerComponent(LOGIN_SCREEN, () => WrappedComponent(Login))
  Navigation.registerComponent(SYNC_LOGIN_SCREEN, () => WrappedComponent(SyncLogin))
  Navigation.registerComponent(AGREEMENT_SCREEN, () => WrappedComponent(Agreement))
  Navigation.registerComponent(HOME_SCREEN, () => WrappedComponent(Home))
  Navigation.registerComponent(PLAY_DETAIL_SCREEN, () => WrappedComponent(PlayDetail))
  Navigation.registerComponent(COMMENT_SCREEN, () => WrappedComponent(Comment))
  Navigation.registerComponent(LEADERBOARD_DETAIL_SCREEN, () => WrappedComponent(LeaderboardDetail))
  Navigation.registerComponent(VERSION_MODAL, () => WrappedComponent(VersionModal))
  Navigation.registerComponent(PACT_MODAL, () => WrappedComponent(PactModal))
  Navigation.registerComponent(SYNC_MODE_MODAL, () => WrappedComponent(SyncModeModal))

  console.info('All screens have been registered...')
}
