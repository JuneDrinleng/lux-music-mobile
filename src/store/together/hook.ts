/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useState } from 'react'

import { subscribeTogether } from './action'
import state, { type TogetherState } from './state'

export const useTogether = (): TogetherState => {
  const [value, update] = useState<TogetherState>(() => ({ ...state }))
  useEffect(() => {
    update({ ...state })
    return subscribeTogether(update)
  }, [])
  return value
}

/** True while this device is in a room (as host or member). */
export const useTogetherActive = (): boolean => useTogether().room != null

/** True while this device is a member (not host) of a room; the player controls are locked. */
export const useTogetherMemberLocked = (): boolean => useTogether().role == 'member'
