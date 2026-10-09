/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import { LIST_IDS } from '@/config/constant'
import settingState from '@/store/setting/state'
import { getListMusics } from '@/utils/listManage'
import { LISTEN_LIST_LIMIT, selectOldestListenIds } from '@/utils/listenListLimit'

const gate = { busy: false, again: false }

/**
 * Drop the earliest songs from the listen list once it grows past 50.
 * Uses the existing list_music_remove action, so the sync payload shape does not change.
 */
export const enforceListenListLimit = async() => {
  if (gate.busy) {
    gate.again = true
    return
  }
  gate.busy = true
  try {
    do {
      gate.again = false
      const songs = await getListMusics(LIST_IDS.DEFAULT)
      const ids = selectOldestListenIds(songs, settingState.setting['list.addMusicLocationType'], LISTEN_LIST_LIMIT)
      if (ids.length) await global.list_event.list_music_remove(LIST_IDS.DEFAULT, ids)
    } while (gate.again)
  } finally {
    gate.busy = false
  }
}
