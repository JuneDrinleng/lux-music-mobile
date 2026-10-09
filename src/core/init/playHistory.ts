/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { pushPlayRecord, startPlayHistorySync } from '@/plugins/sync/playHistorySync'
import { loadPlayHistoryStore } from '@/utils/playHistory/store'
import { startPlayHistoryTracker } from '@/utils/playHistory/tracker'

export default async() => {
  await loadPlayHistoryStore()
  startPlayHistoryTracker((record, reason) => {
    if (reason == 'final') pushPlayRecord(record)
  })
  startPlayHistorySync()
}
