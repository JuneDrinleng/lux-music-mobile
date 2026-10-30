/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useState } from 'react'
import { selectRequestQueue, selectRoomTabs, selectRoomTimeline } from '@/core/together/roomFeed'
import { togetherRoomFeed } from './roomFeed'

export const useTogetherRoomFeed = () => {
  const [state, setState] = useState(togetherRoomFeed.getSnapshot)
  useEffect(() => {
    const update = () => { setState(togetherRoomFeed.getSnapshot()) }
    const unsubscribe = togetherRoomFeed.subscribe(update)
    update()
    return unsubscribe
  }, [])
  return state
}
export const useTogetherRoomTabs = () => selectRoomTabs(useTogetherRoomFeed())
export const useTogetherRoomTimeline = () => selectRoomTimeline(useTogetherRoomFeed())
export const useTogetherRequestQueue = () => selectRequestQueue(useTogetherRoomFeed())
