/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import type { ActiveSession, LoginIntent } from '@/utils/loginSession'

export interface SessionJournal {
  version: 1
  transitionId: string
  generation: number
  phase: 'gatePending' | 'authenticating' | 'preparing' | 'committing'
  previous: ActiveSession | null
  intent: LoginIntent
  pausedDownloads: string[]
  candidate?: ActiveSession
}
export interface SessionCandidate {
  identity: ActiveSession
  prepare: () => Promise<void>
  activate: () => Promise<void>
}
export interface CoordinatorDependencies {
  read: () => Promise<SessionJournal | null>
  write: (journal: SessionJournal) => Promise<void>
  clear: () => Promise<void>
  active: () => ActiveSession | null
  freeze: () => number
  release: () => void
  pause: () => Promise<void>
  flush: () => Promise<void>
  pauseDownloads: () => Promise<string[]>
  leave: () => Promise<void>
  disconnect: () => Promise<void>
  gate: (intent: LoginIntent) => Promise<void>
  publish: (identity: ActiveSession) => Promise<void>
  main: () => Promise<void>
}

/** One owner from quiescing through activation; failures after the checkpoint stay at Gate. */
export class AppSessionCoordinator {
  private journal: SessionJournal | null = null
  private beginning: Promise<void> | null = null
  private submitting: Promise<void> | null = null
  private readyForMain = true
  private barriersReady = false
  constructor(private readonly deps: CoordinatorDependencies) {}
  get pending() { return this.journal }
  get canEnterMain() { return this.readyForMain }

  async recover(): Promise<boolean> {
    const journal = await this.deps.read()
    if (!journal) return false
    this.readyForMain = false
    this.deps.freeze()
    this.journal = journal
    // Even a partially persisted commit must be authenticated/prepared again.
    try {
      await this.deps.pause()
      await this.deps.pauseDownloads()
      this.barriersReady = true
    } catch { this.barriersReady = false }
    await this.deps.disconnect()
    await this.deps.gate(journal.intent)
    return true
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  begin(intent: LoginIntent): Promise<void> {
    if (this.beginning) return this.beginning
    if (this.journal) return Promise.resolve()
    this.readyForMain = false
    const generation = this.deps.freeze()
    const journal: SessionJournal = {
      version: 1,
      transitionId: `${Date.now()}:${generation}`,
      generation,
      phase: 'gatePending',
      previous: this.deps.active(),
      intent,
      pausedDownloads: [],
    }
    const run = (async() => {
      try {
        await this.deps.pause()
        await this.deps.flush()
        journal.pausedDownloads = await this.deps.pauseDownloads()
        this.journal = journal
        await this.deps.write(journal)
        try { await this.deps.leave() } catch (error) {
          // A server-side refusal/cancel aborts the switch while the source connection still exists.
          await this.deps.clear()
          this.journal = null
          throw error
        }
        await this.deps.disconnect()
        this.barriersReady = true
        await this.deps.gate(intent)
      } catch (error) {
        if (!this.journal) {
          this.readyForMain = true
          this.deps.release()
        } else {
          // Never resume the legacy path after durable gatePending.
          await this.deps.disconnect()
          await this.deps.gate(intent)
        }
        throw error
      }
    })()
    this.beginning = run
    void run.finally(() => { this.beginning = null }).catch(() => {})
    return run
  }

  // eslint-disable-next-line @typescript-eslint/promise-function-async
  complete(authenticate: () => Promise<SessionCandidate>): Promise<void> {
    if (this.submitting) return this.submitting
    const run = (async() => {
      if (this.beginning) await this.beginning
      const journal = this.journal
      if (!journal) throw new Error('Login transaction has not started')
      try {
        if (!this.barriersReady) {
          await this.deps.pause()
          await this.deps.pauseDownloads()
          await this.deps.leave()
          await this.deps.disconnect()
          this.barriersReady = true
        }
        journal.phase = 'authenticating'
        await this.deps.write(journal)
        const candidate = await authenticate()
        const expected = journal.intent.targetIdentity
        if (expected) {
          const actual = candidate.identity
          const matches = actual.provider === expected.provider && actual.spaceId === expected.spaceId &&
            (actual.provider === 'local' || (expected.provider !== 'local' && actual.server.serverId === expected.server.serverId && actual.server.url === expected.server.url)) &&
            (actual.provider !== 'lux' || (expected.provider === 'lux' && actual.account.userId === expected.account.userId)) &&
            (actual.provider !== 'lx' || (expected.provider === 'lx' && actual.deviceId === expected.deviceId))
          if (!matches) throw new Error('Login identity mismatch')
        }
        journal.candidate = candidate.identity
        journal.phase = 'preparing'
        await this.deps.write(journal)
        await candidate.prepare()
        journal.phase = 'committing'
        await this.deps.write(journal)
        await candidate.activate()
        await this.deps.publish(candidate.identity)
        this.readyForMain = true
        await this.deps.main()
        await this.deps.clear()
        this.journal = null
        this.deps.release()
      } catch (error) {
        this.readyForMain = false
        await this.deps.disconnect()
        await this.deps.gate(journal.intent)
        throw error
      }
    })()
    this.submitting = run
    void run.finally(() => { this.submitting = null }).catch(() => {})
    return run
  }

  async revokeReturn(): Promise<void> {
    if (this.journal) {
      this.journal.previous = null
      this.journal.intent.returnPolicy = 'none'
      await this.deps.write(this.journal)
    }
  }

  async cancel(restore: (previous: ActiveSession) => Promise<SessionCandidate>): Promise<void> {
    if (this.submitting) return this.submitting
    const previous = this.journal?.previous
    if (!previous || this.journal?.intent.returnPolicy !== 'restorePrevious') return Promise.reject(new Error('Previous session unavailable'))
    // Restore is another preparation/activation, never a stale component or automatic play.
    this.journal.intent = { reason: 'switch', source: 'cancel', returnPolicy: 'none', targetIdentity: previous }
    return this.complete(async() => restore(previous))
  }
}
