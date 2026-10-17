declare global {
  namespace LX {
    namespace Sync {
      type Mode = 'lx' | 'lux'

      /** Per-mode sync login form values (AsyncStorage, app-private). */
      interface LuxLoginProfile {
        host: string
        luxUsername: string
        luxPassword: string
      }

      interface LxLoginProfile {
        host: string
        lxAuthCode: string
      }

      interface LoginDrafts {
        lux?: LuxLoginProfile
        lx?: LxLoginProfile
      }

      /** @deprecated Migrated to LoginDrafts on read. */
      interface LoginDraft {
        host: string
        mode: Mode
        luxUsername: string
        luxPassword: string
        lxAuthCode: string
      }

      interface LuxAuth {
        token: string
        serverId?: string
        serverUrl?: string
        user: {
          id: string
          username: string
          displayName?: string
          avatar?: string
          gender?: 'male' | 'female' | 'unknown'
          signature?: string
          role: 'admin' | 'user'
          source: string
          status: string
        }
      }

      interface LuxProfile {
        displayName: string
        avatar: string
        gender: 'male' | 'female' | 'unknown'
        signature: string
      }

      interface Status {
        status: boolean
        message: string
      }

      interface KeyInfo {
        clientId: string
        key: string
        serverName: string
        /** Local ownership metadata; never sent as part of the sync protocol. */
        luxUserId?: string
        lxAuthCodeHash?: string
      }

      interface Socket extends WebSocket {
        isReady: boolean
        data: {
          keyInfo: KeyInfo
          urlInfo: UrlInfo
        }
        moduleReadys: {
          list: boolean
          dislike: boolean
          playHistory: boolean
          together: boolean
        }

        onClose: (handler: (err: Error) => (void | Promise<void>)) => () => void

        remote: LX.Sync.ServerSyncActions
        remoteQueueList: LX.Sync.ServerSyncListActions
        remoteQueueDislike: LX.Sync.ServerSyncDislikeActions
      }


      interface ModeTypes {
        list: LX.Sync.List.SyncMode
        dislike: LX.Sync.Dislike.SyncMode
      }

      type ModeType = { [K in keyof ModeTypes]: { type: K, mode: ModeTypes[K], remember?: boolean } }[keyof ModeTypes]

      interface UrlInfo {
        wsProtocol: string
        httpProtocol: string
        hostPath: string
        href: string
      }

      interface ListConfig {
        skipSnapshot: boolean
      }
      interface DislikeConfig {
        skipSnapshot: boolean
      }
      type ServerType = 'desktop-app' | 'server'
      interface EnabledFeatures {
        list?: false | ListConfig
        dislike?: false | DislikeConfig
        /** Lux only. Omitted for LX connection-code sync and for servers that do not advertise the feature. */
        playHistory?: true
        /** Lux only. Listen-together rooms; omitted for LX connection-code sync. */
        together?: true
      }
      type SupportedFeatures = Partial<{ [k in keyof EnabledFeatures]: number }>
    }
  }
}

export {}
