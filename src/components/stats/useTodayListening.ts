/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useEffect, useState } from 'react'

import { getPlayRecords, subscribePlayHistory } from '@/utils/playHistory/store'
import { rangeBounds, recordInBounds } from '@/utils/playHistory/range'

const useListenedMinutes = (range: 'today' | 'days7'): number => {
  const [minutes, setMinutes] = useState(0)
  useEffect(() => {
    const update = () => {
      const bounds = rangeBounds(range, Date.now())
      let listenedMs = 0
      for (const record of getPlayRecords()) {
        if (recordInBounds(record, bounds)) listenedMs += record.listenedMs
      }
      setMinutes(Math.floor(listenedMs / 60_000))
    }
    update()
    return subscribePlayHistory(update)
  }, [range])
  return minutes
}

/** Today's listened minutes, floored, from the local play records. */
export const useTodayListenedMinutes = (): number => useListenedMinutes('today')

/** Last 7 days listened minutes (including today), floored. */
export const useDays7ListenedMinutes = (): number => useListenedMinutes('days7')
