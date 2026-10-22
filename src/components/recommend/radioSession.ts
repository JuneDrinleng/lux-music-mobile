/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { sameSong } from '@/utils/recommend/engine'
import { type Recommendation, type Song } from '@/utils/recommend/types'

export type RadioTaste = 'familiar' | 'balanced' | 'explore'
export const RADIO_BATCH_SIZE = 10
/** Two upcoming songs plus the current song = the preview's last three tracks. */
export const RADIO_REMAINING = 2
export const radioTasteParameters = (taste: RadioTaste) => ({
  limit: RADIO_BATCH_SIZE,
  affinityWeight: taste == 'familiar' ? 2 : taste == 'explore' ? 0.25 : 1,
  discoveryWeight: taste == 'familiar' ? 0 : taste == 'explore' ? 8 : 2,
})
export interface RadioState {
  seed: Song | null
  taste: RadioTaste
  added: readonly Song[]
  played: number
}
interface QueueSnapshot { songs: Song[], index: number, active: boolean }
interface RadioDependencies {
  snapshot: () => Promise<QueueSnapshot>
  next: (seed: Song, exclude: readonly Song[], options: ReturnType<typeof radioTasteParameters>) => Promise<{ items: Recommendation[] }>
  append: (items: Recommendation[], isCurrent: () => boolean) => Promise<unknown>
  writeDislike: (song: Song) => Promise<unknown>
  remove: (song: Song, isCurrent: () => boolean) => Promise<unknown>
  isDisliked: (song: Song) => boolean
}

/** Session controller has no screen/foreground dependency. Each async boundary rechecks
 * the session, queue and dislikes so stopped/replaced radios cannot append stale work. */
export const createRadioSession = (deps: RadioDependencies) => {
  let state: RadioState = { seed: null, taste: 'balanced', added: [], played: 0 }
  let generation = 0
  let sessionEpoch = 0
  let busy = false
  let seen: Song[] = []
  let rejected: Song[] = []
  const played = new Set<string>()
  const listeners = new Set<() => void>()
  const publish = (next: RadioState) => { state = next; for (const listener of listeners) listener() }
  const stop = () => { generation++; sessionEpoch++; publish({ ...state, seed: null }) }
  return {
    getState: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    stop,
    start: (seed: Song, songs: readonly Song[]) => {
      generation++
      sessionEpoch++
      seen = [...songs]
      rejected = []
      played.clear()
      publish({ seed, taste: 'balanced', added: [], played: 0 })
    },
    setTaste: (taste: RadioTaste) => { generation++; publish({ ...state, taste }) },
    dislike: async(song: Song) => {
      const session = sessionEpoch
      rejected.push(song)
      await deps.writeDislike(song)
      if (session != sessionEpoch || !state.seed) return
      await deps.remove(song, () => session == sessionEpoch && !!state.seed)
    },
    replenish: async() => {
      if (!state.seed || busy) return
      busy = true
      const session = generation
      const valid = () => session == generation && !!state.seed
      try {
        const queue = await deps.snapshot()
        if (!valid()) return
        if (!queue.active || !queue.songs.length || !queue.songs.some(song => seen.some(old => sameSong(old, song)))) { stop(); return }
        if (queue.index < 0 || queue.index >= queue.songs.length) return
        for (const song of queue.songs.slice(0, queue.index)) played.add(JSON.stringify([song.source, song.songmid]))
        if (state.played != played.size) publish({ ...state, played: played.size })
        if (queue.songs.length - queue.index - 1 > RADIO_REMAINING) return
        seen.push(...queue.songs.filter(song => !seen.some(old => sameSong(old, song))))
        const batch = await deps.next(state.seed, [...seen, ...rejected], radioTasteParameters(state.taste))
        if (!valid()) return
        const latest = await deps.snapshot()
        if (!valid()) return
        if (!latest.active || !latest.songs.length || !latest.songs.some(song => seen.some(old => sameSong(old, song)))) { stop(); return }
        const blocked = [...seen, ...latest.songs, ...rejected]
        const items = batch.items.filter(item => {
          if (deps.isDisliked(item.song) || blocked.some(song => sameSong(song, item.song))) return false
          blocked.push(item.song)
          return true
        }).slice(0, RADIO_BATCH_SIZE)
        if (!items.length) return
        await deps.append(items, valid)
        if (!valid()) return
        seen.push(...items.map(item => item.song))
        publish({ ...state, added: [...state.added, ...items.map(item => item.song)] })
      } finally {
        // Single-flight ownership: only this invocation can release the lock.
        // eslint-disable-next-line require-atomic-updates
        busy = false
      }
    },
  }
}
