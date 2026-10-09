/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

export const PLAYLIST_COVER_MAX_ATTEMPTS = 3
export const PLAYLIST_COVER_DROP_COOLDOWN_MS = 10 * 60 * 1000
export const VISIBLE_COVER_CONCURRENCY = 3
export const PLAYLIST_COVER_CONCURRENCY = 2
export const BACKGROUND_COVER_CONCURRENCY = 2

export type PlaylistCoverPriority = 'visible' | 'playlist' | 'background'

export interface CoverQueueJob {
  key: string
  priority: PlaylistCoverPriority
  attempts: number
  notBefore: number
}

const PRIORITY_RANK: Record<PlaylistCoverPriority, number> = {
  visible: 0,
  playlist: 1,
  background: 2,
}

const LANE_ORDER: readonly PlaylistCoverPriority[] = ['visible', 'playlist', 'background']

export const playlistCoverPriorityRank = (priority: PlaylistCoverPriority) => PRIORITY_RANK[priority]

/** Backoff after a failed attempt. `failedAttempts` is 1-based. */
export const playlistCoverRetryDelay = (failedAttempts: number) => {
  const exponent = Math.min(4, Math.max(0, failedAttempts - 1))
  return 2000 * (2 ** exponent)
}

export type CoverEnqueueResult = 'added' | 'upgraded' | 'duplicate'

interface Slot {
  key: string
  gen: number
}

/**
 * One lane. Visible work is a stack (newest taken first). Playlist and background
 * are queues (oldest taken first). Stale slots are skipped, so moving a key is O(1).
 */
class CoverLane {
  private slots: Slot[] = []
  private head = 0

  pushBack(slot: Slot) {
    this.slots.push(slot)
  }

  pushFront(slot: Slot) {
    if (this.head > 0) {
      this.head -= 1
      this.slots[this.head] = slot
      return
    }
    this.slots.unshift(slot)
  }

  popBack(): Slot | null {
    if (this.slots.length <= this.head) return null
    const slot = this.slots.pop()!
    if (this.slots.length === this.head) {
      this.slots = []
      this.head = 0
    }
    return slot
  }

  popFront(): Slot | null {
    if (this.head >= this.slots.length) {
      this.slots = []
      this.head = 0
      return null
    }
    const slot = this.slots[this.head]
    this.head += 1
    if (this.head > 64 && this.head * 2 > this.slots.length) {
      this.slots = this.slots.slice(this.head)
      this.head = 0
    }
    return slot
  }

  take(priority: PlaylistCoverPriority): Slot | null {
    return priority == 'visible' ? this.popBack() : this.popFront()
  }
}

/**
 * In-memory prefetch queue.
 * Visible work is always taken before playlist work, and playlist work before background.
 * A lower-priority enqueue never downgrades a job. Failed jobs retry with backoff until
 * PLAYLIST_COVER_MAX_ATTEMPTS, then stay blocked for background re-enqueue.
 *
 * Each lane is its own queue plus a membership generation, so enqueue of a new key does
 * not scan the library.
 */
export class PlaylistCoverQueue {
  private readonly pending = new Map<string, CoverQueueJob>()
  private readonly lanes: Record<PlaylistCoverPriority, CoverLane> = {
    visible: new CoverLane(),
    playlist: new CoverLane(),
    background: new CoverLane(),
  }

  private readonly generation = new Map<string, number>()
  private readonly readyCount: Record<PlaylistCoverPriority, number> = {
    visible: 0,
    playlist: 0,
    background: 0,
  }

  private readonly blocked = new Map<string, number>()
  private delayed: CoverQueueJob[] = []
  private nextGen = 1

  size() {
    return this.pending.size
  }

  enqueue(key: string, priority: PlaylistCoverPriority, now = 0): CoverEnqueueResult {
    const blockedUntil = this.blocked.get(key) ?? 0
    if (blockedUntil > now && priority == 'background') return 'duplicate'
    if (blockedUntil > 0) this.blocked.delete(key)

    const existing = this.pending.get(key)
    if (!existing) {
      const job: CoverQueueJob = { key, priority, attempts: 0, notBefore: now }
      this.pending.set(key, job)
      this.placeReady(job, 'back')
      return 'added'
    }
    const promoted = playlistCoverPriorityRank(priority) < playlistCoverPriorityRank(existing.priority)
    if (promoted || priority == 'visible') {
      this.detach(key, false)
      if (promoted) {
        existing.priority = priority
        existing.notBefore = now
      }
      this.placeReady(existing, 'back')
      return promoted ? 'upgraded' : 'duplicate'
    }
    return 'duplicate'
  }

  take(now: number, priorities?: readonly PlaylistCoverPriority[]): CoverQueueJob | null {
    this.promote(now)
    for (const priority of LANE_ORDER) {
      if (priorities && !priorities.includes(priority)) continue
      const lane = this.lanes[priority]
      while (this.readyCount[priority] > 0) {
        const slot = lane.take(priority)
        if (!slot) {
          this.readyCount[priority] = 0
          break
        }
        if (!this.isCurrent(slot)) continue
        const job = this.pending.get(slot.key)
        this.generation.delete(slot.key)
        this.readyCount[priority] -= 1
        if (!job) continue
        if (job.notBefore > now) {
          this.delayed.push(job)
          continue
        }
        this.pending.delete(slot.key)
        return { ...job }
      }
    }
    return null
  }

  fail(job: CoverQueueJob, now: number): 'retry' | 'drop' {
    const attempts = job.attempts + 1
    if (attempts >= PLAYLIST_COVER_MAX_ATTEMPTS) {
      this.blocked.set(job.key, now + PLAYLIST_COVER_DROP_COOLDOWN_MS)
      return 'drop'
    }
    const next: CoverQueueJob = {
      ...job,
      attempts,
      notBefore: now + playlistCoverRetryDelay(attempts),
    }
    this.pending.set(job.key, next)
    this.delayed.push(next)
    return 'retry'
  }

  /** Put a taken job back without counting a failure (for example while waiting for Wi-Fi). */
  delay(job: CoverQueueJob, notBefore: number) {
    const next = { ...job, notBefore }
    this.pending.set(job.key, next)
    if (notBefore <= Date.now()) this.placeReady(next, 'back')
    else this.delayed.push(next)
  }

  hasReady(priority: PlaylistCoverPriority, now: number) {
    this.promote(now)
    return this.readyCount[priority] > 0
  }

  demote(from: PlaylistCoverPriority, to: PlaylistCoverPriority) {
    if (playlistCoverPriorityRank(to) <= playlistCoverPriorityRank(from)) return
    this.promote(Date.now())
    const moved: CoverQueueJob[] = []
    const lane = this.lanes[from]
    while (this.readyCount[from] > 0) {
      const slot = lane.take(from)
      if (!slot || !this.isCurrent(slot)) continue
      const job = this.pending.get(slot.key)
      this.generation.delete(slot.key)
      this.readyCount[from] -= 1
      if (job) moved.push(job)
    }
    const stay: CoverQueueJob[] = []
    for (const job of this.delayed) {
      if (job.priority == from) moved.push(job)
      else stay.push(job)
    }
    this.delayed = stay
    for (let index = moved.length - 1; index >= 0; index -= 1) {
      const job = moved[index]
      job.priority = to
      if (job.notBefore > Date.now()) this.delayed.push(job)
      else this.placeReady(job, 'front')
    }
  }

  forget(key: string) {
    this.blocked.delete(key)
    this.detach(key, true)
  }

  isBlocked(key: string, now: number) {
    return (this.blocked.get(key) ?? 0) > now
  }

  private isCurrent(slot: Slot) {
    return this.generation.get(slot.key) == slot.gen
  }

  private detach(key: string, dropPending: boolean) {
    const job = this.pending.get(key)
    const hadGen = this.generation.delete(key)
    if (!hadGen) {
      this.delayed = this.delayed.filter(item => item.key != key)
      if (dropPending) this.pending.delete(key)
      return
    }
    if (job && this.readyCount[job.priority] > 0) this.readyCount[job.priority] -= 1
    this.delayed = this.delayed.filter(item => item.key != key)
    if (dropPending) this.pending.delete(key)
  }

  private placeReady(job: CoverQueueJob, where: 'back' | 'front') {
    const gen = this.nextGen
    this.nextGen += 1
    this.generation.set(job.key, gen)
    const slot = { key: job.key, gen }
    const lane = this.lanes[job.priority]
    if (where == 'front') lane.pushFront(slot)
    else lane.pushBack(slot)
    this.readyCount[job.priority] += 1
  }

  private promote(now: number) {
    if (!this.delayed.length) return
    const due: CoverQueueJob[] = []
    const stay: CoverQueueJob[] = []
    for (const job of this.delayed) {
      if (job.notBefore <= now) due.push(job)
      else stay.push(job)
    }
    if (!due.length) return
    this.delayed = stay
    for (const job of due) {
      if (this.pending.get(job.key) != job) continue
      // Retries wait behind work that is already ready in the same lane.
      this.placeReady(job, job.priority == 'visible' ? 'front' : 'back')
    }
  }
}
