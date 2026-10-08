/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { getMusicInfo } from './musicInfo'

export default {
  async getPic(songInfo) {
    const info = await getMusicInfo(songInfo.songmid)
    return info.img
  },
}
