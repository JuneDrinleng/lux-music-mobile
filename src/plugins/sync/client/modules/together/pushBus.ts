/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export type TogetherPush = { sessionId: number } & (
  | { type: 'roomState', push: LX.Sync.Together.RoomStatePush }
  | { type: 'memberChanged', push: LX.Sync.Together.MemberChangedPush }
  | { type: 'hostChanged', push: LX.Sync.Together.HostChangedPush }
  | { type: 'roomClosed', push: LX.Sync.Together.RoomClosedPush }
)

let pushListener: ((push: TogetherPush) => void) | null = null

export const setTogetherPushListener = (listener: ((push: TogetherPush) => void) | null) => {
  pushListener = listener
}

export const emitTogetherPush = (push: TogetherPush) => {
  pushListener?.(push)
}
