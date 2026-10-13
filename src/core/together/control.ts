/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import togetherState from '@/store/together/state'
import { toast } from '@/utils/tools'

/**
 * Member-side control lock (protocol §4.6: members cannot switch songs, seek, or skip).
 * Must not import core/player: player.ts imports this module.
 */

let applyingDepth = 0
let onBlocked: (() => void) | null = null

export const isTogetherMemberLocked = (): boolean => togetherState.role == 'member' && applyingDepth == 0

/** Run player calls that apply the host's state; the lock is bypassed while `fn` runs. */
export const runAsTogetherApply = async<T>(fn: () => Promise<T>): Promise<T> => {
  applyingDepth += 1
  try {
    return await fn()
  } finally {
    applyingDepth -= 1
  }
}

export const setTogetherBlockedHandler = (handler: (() => void) | null) => {
  onBlocked = handler
}

/** Returns true (and tells the user) when the call must be dropped. */
export const blockTogetherMemberControl = (): boolean => {
  if (!isTogetherMemberLocked()) return false
  toast(global.i18n.t('together_member_locked'))
  onBlocked?.()
  return true
}
