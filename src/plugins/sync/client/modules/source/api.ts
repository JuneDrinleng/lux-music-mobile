/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

const remoteOf = (socket: LX.Sync.Socket) => socket.remote as unknown as LX.Sync.ServerSyncSourceActions

export const fetchSourceInfo = async(socket: LX.Sync.Socket) => remoteOf(socket)['source:getInfo']()

export const resolveMusicUrl = async(socket: LX.Sync.Socket, req: LX.Sync.Source.MusicUrlRequest) => {
  return remoteOf(socket)['source:resolveMusicUrl'](req)
}

export const resolveLyric = async(socket: LX.Sync.Socket, req: LX.Sync.Source.LyricRequest) => {
  return remoteOf(socket)['source:resolveLyric'](req)
}

export const resolvePic = async(socket: LX.Sync.Socket, req: LX.Sync.Source.PicRequest) => {
  return remoteOf(socket)['source:resolvePic'](req)
}

/** `proxied` URLs are server paths; the player needs an absolute address on the sync host. */
export const toPlayableUrl = (socket: LX.Sync.Socket, result: LX.Sync.Source.MusicUrlResult): string => {
  if (!result.proxied) return result.url
  const { httpProtocol, hostPath } = socket.data.urlInfo
  return `${httpProtocol}//${hostPath}${result.url}`
}
