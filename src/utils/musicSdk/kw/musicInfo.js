/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { httpFetch } from '../../request'
import { normalizeCachedSongId } from '../../localSongRows'
import { kwRidMusicInfoUrl, parseKwSearchMusicInfo } from '../../kwMusicInfoParse'

/**
 * Look up Kuwo song metadata by rid.
 * The www musicInfo endpoint returns "The request is illegal!" without a working CSRF
 * cookie flow (helpers are commented out). search.kuwo.cn?rid=MUSIC_<id>&mobi=1 works
 * and is the same family already used for Kuwo search/album detail.
 */
export const getMusicInfo = songmid => {
  const mid = normalizeCachedSongId('kw', songmid)
  const request = httpFetch(kwRidMusicInfoUrl(mid))
  request.promise = request.promise.then(({ body }) => {
    const info = parseKwSearchMusicInfo(body, mid)
    if (!info?.name) throw new Error(body?.msg || body?.message || 'Missing music info')
    return info
  })
  return request
}
