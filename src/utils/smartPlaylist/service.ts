/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { type LibrarySong } from './evaluator'

/** One pending timer and one running pass. Events during a pass request one follow-up. */
export const createSmartRefresh = (run: () => Promise<void>, delay = 400, onError: (error: unknown) => void = () => {}) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running = false
  let pending = false
  let stopped = false
  const trigger = () => {
    if (stopped) return
    pending = true
    if (running) return
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      pending = false
      running = true
      void run().catch(onError).finally(() => {
        running = false
        if (pending) trigger()
      })
    }, delay)
  }
  return { trigger, stop: () => { stopped = true; pending = false; if (timer) clearTimeout(timer) } }
}

/** Existing overwrite API preserves exact evaluator order, independent of add-location preferences. */
export const materializeSongs = async<T extends LibrarySong>(current: readonly T[], songs: T[], write: (songs: T[]) => Promise<void>): Promise<boolean> => {
  let same = current.length == songs.length
  if (same) {
    for (let i = 0; i < current.length; i++) {
      if (i % 100 == 0) await new Promise<void>(resolve => { setTimeout(resolve, 0) })
      if (current[i].id != songs[i].id || current[i].source != songs[i].source) { same = false; break }
    }
  }
  if (same) return false
  await write(songs)
  return true
}
