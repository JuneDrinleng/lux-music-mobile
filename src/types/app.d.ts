/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

/* eslint-disable no-var */
import type { AppEventTypes } from '@/event/appEvent'
import type { ListEventTypes } from '@/event/listEvent'
import type { DislikeEventTypes } from '@/event/dislikeEvent'
import type { StateEventTypes } from '@/event/stateEvent'
import type { I18n } from '@/lang/i18n'
import type { Buffer as _Buffer } from 'buffer'

type SettingScreenIds =
  | 'basic'
  | 'player'
  | 'lyric_desktop'
  | 'search'
  | 'list'
  | 'sync'
  | 'backup'
  | 'other'
  | 'version'
  | 'about'

// interface Process {
//   env: {
//     NODE_ENV: 'development' | 'production'
//   }
//   versions: {
//     app: string
//   }
// }
interface GlobalData {
  fontSize: number
  gettingUrlId: string

  // event_app: AppType
  // event_list: ListType

  playerStatus: {
    isInitialized: boolean
    isRegisteredService: boolean
    isIniting: boolean
  }
  restorePlayInfo: LX.Player.SavedPlayInfo | null
  isScreenKeepAwake: boolean
  isPlayedStop: boolean
  isEnableSyncLog: boolean
  isEnableUserApiLog: boolean
  playerTrackId: string

  qualityList: LX.QualityList
  apis: Partial<LX.UserApi.UserApiSources>
  apiInitPromise: [Promise<boolean>, boolean, (success: boolean) => void]

  jumpMyListPosition: boolean

  settingActiveId: SettingScreenIds
  isShowingLaunchScreen: boolean

  /**
   * 首页是否正在滚动中，用于防止意外误触播放歌曲
   */
  homePagerIdle: boolean

  // windowInfo: {
  //   screenW: number
  //   screenH: number
  //   fontScale: number
  //   pixelRatio: number
  //   screenPxW: number
  //   screenPxH: number
  // }

  // syncKeyInfo: LX.Sync.KeyInfo
}


declare global {
  var isDev: boolean
  var lx: GlobalData
  var i18n: I18n
  var app_event: AppEventTypes
  var list_event: ListEventTypes
  var dislike_event: DislikeEventTypes
  var state_event: StateEventTypes

  var Buffer: typeof _Buffer

  module NodeJS {
    interface ProcessVersions {
      app: string
    }
  }
  // var process: Process
}
