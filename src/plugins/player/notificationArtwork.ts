/** Request full cover variants only for known provider thumbnail formats. */
export const notificationArtwork = (cover?: string | null): string | undefined => {
  const url = cover?.trim()
  if (!url) return undefined
  if (/^https?:\/\/[^/]*music\.126\.net\//i.test(url)) {
    return url.replace(/([?&])param=\d+y\d+(&?)/i, (_, prefix: string, suffix: string) => suffix ? prefix : '').replace(/[?&]$/, '')
  }
  if (/^https?:\/\/y\.gtimg\.cn\//i.test(url)) {
    return url.replace(/(T00[12])R\d+x\d+(M000)/, '$1$2')
  }
  if (/^https?:\/\/[^/]*kuwo\.cn\//i.test(url)) {
    return url.replace(/(\/albumcover\/)(\d+)\//, (size, prefix: string, width: string) => Number(width) < 500 ? `${prefix}500/` : size)
  }
  if (/^https?:\/\/[^/]*kugou\.com\//i.test(url)) {
    return url.replace(/(\/stdmusic\/)(\d+)\//, (size, prefix: string, width: string) => Number(width) > 0 ? `${prefix}0/` : size)
  }
  // Local bitmaps and unknown/signed provider URLs must remain intact.
  return url
}
