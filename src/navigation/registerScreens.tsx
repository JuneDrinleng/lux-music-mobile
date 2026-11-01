/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

// @flow

import { SubpageScreen } from './SubpageScreen'
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
import AccountDataDialog from './components/AccountDataDialog'
import { ACCOUNT_DATA_OVERLAY } from '@/utils/accountDataDialogs'
import SessionExpiredDialog from './components/SessionExpiredDialog'
import { SESSION_EXPIRED_OVERLAY } from '@/plugins/sync/client/sessionExpired'
import VersionModal from './components/VersionModal'
import PactModal from './components/PactModal'
import SyncModeModal from './components/SyncModeModal'

function WrappedComponent(Component: any, subpage = true) {
  return function inject(props: Record<string, any>) {
    const EnhancedComponent = () => (
      <Provider>
        <LuxThemeProvider>
          {subpage && props.mode !== 'overlay'
            ? <SubpageScreen componentId={props.componentId}><Component {...props} /></SubpageScreen>
            : <Component {...props} />}
        </LuxThemeProvider>
      </Provider>
    )

    return <EnhancedComponent />
  }
}

export default () => {
  Navigation.registerComponent(ACCOUNT_DATA_OVERLAY, () => WrappedComponent(AccountDataDialog, false))
  Navigation.registerComponent(SESSION_EXPIRED_OVERLAY, () => WrappedComponent(SessionExpiredDialog, false))
  Navigation.registerComponent(LAUNCH_SCREEN, () => WrappedComponent(Launch, false))
  Navigation.registerComponent(LOGIN_SCREEN, () => WrappedComponent(Login, false))
  Navigation.registerComponent(SYNC_LOGIN_SCREEN, () => WrappedComponent(SyncLogin, false))
  Navigation.registerComponent(AGREEMENT_SCREEN, () => WrappedComponent(Agreement, true))
  Navigation.registerComponent(HOME_SCREEN, () => WrappedComponent(Home, false))
  Navigation.registerComponent(PLAY_DETAIL_SCREEN, () => WrappedComponent(PlayDetail, true))
  Navigation.registerComponent(COMMENT_SCREEN, () => WrappedComponent(Comment, true))
  Navigation.registerComponent(LEADERBOARD_DETAIL_SCREEN, () => WrappedComponent(LeaderboardDetail, true))
  Navigation.registerComponent(VERSION_MODAL, () => WrappedComponent(VersionModal, false))
  Navigation.registerComponent(PACT_MODAL, () => WrappedComponent(PactModal, false))
  Navigation.registerComponent(SYNC_MODE_MODAL, () => WrappedComponent(SyncModeModal, false))

  console.info('All screens have been registered...')
}
