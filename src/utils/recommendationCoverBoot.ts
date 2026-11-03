/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// RN Image.prefetch only warms original bytes. Wait for the two mounted Images'
// onLoad events instead, so the actual card-sized blur runs under the splash.
// The existing homeBootRevealAt deadline remains the sole waiting budget.
let finished = false
let expected: string[] | null = null
const loaded = new Set<string>()
let resolveReady: () => void = () => {}
export const recommendationBootCoversReady = new Promise<void>(resolve => { resolveReady = resolve })

export const finishRecommendationCoverBoot = () => {
  finished = true
  expected = null
  loaded.clear()
  resolveReady()
}
const check = () => {
  if (expected && expected.every(uri => loaded.has(uri))) finishRecommendationCoverBoot()
}
export const setRecommendationBootCovers = (uris: Array<string | undefined>) => {
  if (finished) return
  expected = uris.filter((uri): uri is string => !!uri)
  // At most the current two backgrounds are relevant to this boot gate.
  for (const uri of loaded) if (!expected.includes(uri)) loaded.delete(uri)
  check()
}
export const noteRecommendationBootCoverLoaded = (uri: string) => {
  if (finished || expected?.includes(uri) === false || loaded.has(uri)) return
  if (loaded.size >= 2) loaded.delete(loaded.values().next().value!)
  loaded.add(uri)
  check()
}
