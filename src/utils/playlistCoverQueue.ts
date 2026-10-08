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

export const playlistCoverPriorityRank = (priority: PlaylistCoverPriority) => PRIORITY_RANK[priority]

/** Backoff after a failed attempt. `failedAttempts` is 1-based. */
export const playlistCoverRetryDelay = (failedAttempts: number) => {
  const exponent = Math.min(4, Math.max(0, failedAttempts - 1))
  return 2000 * (2 ** exponent)
}

export type CoverEnqueueResult = 'added' | 'upgraded' | 'duplicate'

/**
 * In-memory prefetch queue.
 * Visible work is always taken before playlist work, and playlist work before background.
 * A lower-priority enqueue never downgrades a job. Failed jobs retry with backoff until
 * PLAYLIST_COVER_MAX_ATTEMPTS, then stay blocked for background re-enqueue.
 */
export class PlaylistCoverQueue {
  private readonly pending = new Map<string, CoverQueueJob>()
  private order: string[] = []
  private readonly blocked = new Map<string, number>()

  size() {
    return this.pending.size
  }

  enqueue(key: string, priority: PlaylistCoverPriority, now = 0): CoverEnqueueResult {
    const blockedUntil = this.blocked.get(key) ?? 0
    if (blockedUntil > now && priority == 'background') return 'duplicate'
    if (blockedUntil > 0) this.blocked.delete(key)

    const place = (itemKey: string, itemPriority: PlaylistCoverPriority) => {
      this.order = this.order.filter(item => item != itemKey)
      if (itemPriority == 'visible') this.order.unshift(itemKey)
      else this.order.push(itemKey)
    }
    const existing = this.pending.get(key)
    if (!existing) {
      this.pending.set(key, { key, priority, attempts: 0, notBefore: now })
      place(key, priority)
      return 'added'
    }
    const promoted = playlistCoverPriorityRank(priority) < playlistCoverPriorityRank(existing.priority)
    if (promoted) {
      existing.priority = priority
      existing.notBefore = now
    }
    if (promoted || priority == 'visible') {
      place(key, existing.priority)
      return promoted ? 'upgraded' : 'duplicate'
    }
    return 'duplicate'
  }

  take(now: number, priorities?: readonly PlaylistCoverPriority[]): CoverQueueJob | null {
    let bestIndex = -1
    let bestRank = Number.POSITIVE_INFINITY
    for (let index = 0; index < this.order.length; index++) {
      const job = this.pending.get(this.order[index])
      if (!job || job.notBefore > now) continue
      if (priorities && !priorities.includes(job.priority)) continue
      const rank = playlistCoverPriorityRank(job.priority)
      if (rank < bestRank) {
        bestRank = rank
        bestIndex = index
      }
    }
    if (bestIndex < 0) return null
    const key = this.order[bestIndex]
    this.order.splice(bestIndex, 1)
    const job = this.pending.get(key)
    this.pending.delete(key)
    return job ? { ...job } : null
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
    this.order.push(job.key)
    return 'retry'
  }

  /** Put a taken job back without counting a failure (for example while waiting for Wi-Fi). */
  delay(job: CoverQueueJob, notBefore: number) {
    this.pending.set(job.key, { ...job, notBefore })
    this.order.push(job.key)
  }

  hasReady(priority: PlaylistCoverPriority, now: number) {
    for (const job of this.pending.values()) {
      if (job.priority == priority && job.notBefore <= now) return true
    }
    return false
  }

  demote(from: PlaylistCoverPriority, to: PlaylistCoverPriority) {
    if (playlistCoverPriorityRank(to) <= playlistCoverPriorityRank(from)) return
    for (const job of this.pending.values()) {
      if (job.priority == from) job.priority = to
    }
  }

  forget(key: string) {
    this.pending.delete(key)
    this.blocked.delete(key)
    this.order = this.order.filter(item => item != key)
  }

  isBlocked(key: string, now: number) {
    return (this.blocked.get(key) ?? 0) > now
  }
}
