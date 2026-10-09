/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { httpFetch } from '../../request'
import { normalizeCachedSongId } from '../../localSongRows'

/** Independent request handles let the local library hydrate several songs concurrently. */
export const getMusicInfo = songmid => {
  const mid = normalizeCachedSongId('kw', songmid)
  const request = httpFetch(`http://www.kuwo.cn/api/www/music/musicInfo?mid=${encodeURIComponent(mid)}`)
  request.promise = request.promise.then(({ body }) => {
    if (body?.code != 200 || !body.data) throw new Error(body?.msg || 'Missing music info')
    return body.data
  })
  return request
}
