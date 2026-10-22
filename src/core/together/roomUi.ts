/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import type { ReactionEntry, RoomFeedState } from './roomFeed'

export const FLOATING_REACTION_LIMIT = 12
export const FLOATING_REACTION_TTL = 3200
/** Use local receipt time: server clocks must not extend a floating layer's lifetime. */
export interface FloatingReaction { id: string, emoji: string, receivedAt: number }
export const expireFloatingReactions = (queue: FloatingReaction[], now: number) => queue.filter(item => now - item.receivedAt < FLOATING_REACTION_TTL).slice(-FLOATING_REACTION_LIMIT)
export const appendFloatingReactions = (queue: FloatingReaction[], entries: ReactionEntry[], now: number) => expireFloatingReactions([
  ...queue,
  ...entries.filter(entry => !queue.some(item => item.id == entry.id)).map(entry => ({ id: entry.id, emoji: entry.reaction.emoji, receivedAt: now })),
], now)
export const roomUiTabs = (state: RoomFeedState) => [
  ...(state.capabilities.chat || state.capabilities.reactions ? ['chat'] : []),
  ...(state.capabilities.requests ? ['requests'] : []),
  'members',
]
export const shouldMountRequestSheet = (open: boolean, supported: boolean, roomId: string | null) => open && supported && roomId != null
export const reorderRequestIds = (ids: string[], from: number, to: number) => {
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length) return ids
  const result = [...ids]
  result.splice(to, 0, ...result.splice(from, 1))
  return result
}
