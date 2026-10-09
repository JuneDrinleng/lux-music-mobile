/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { AppState } from 'react-native'

import { getLuxAuth, getSyncHost, getSyncMode } from '@/utils/data'
import { log } from '@/utils/log'
import { mergePlayRecords } from '@/utils/playHistory/merge'
import {
  getPlayHistoryCursor,
  getPlayRecords,
  replacePlayRecords,
  savePlayHistoryCursor,
} from '@/utils/playHistory/store'
import { getOpenPlaySessionId } from '@/utils/playHistory/tracker'
import { type PlayHistoryCursor, type PlayRecord } from '@/utils/playHistory/types'
import { chunkWireRecords, PLAY_HISTORY_PULL, PLAY_HISTORY_PUSH, toWireRecord } from '@/utils/playHistory/wire'

import { getReadySyncSocket, onSyncSocketReady } from './client/client'
import { isPlayHistoryFeatureEnabled } from './playHistoryFlag'

let unsupported = false
let syncing: Promise<void> | null = null
let started = false

const localOnlyMessage = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return /playHistory is not enabled|not found|unknown action|unknown method|unsupported|no such|cannot find|is not a function|未找到|不存在/i.test(message)
}

const parsePull = (value: unknown): { records: PlayRecord[], cursor: number, hasMore: boolean } | null => {
  if (!value || typeof value != 'object') return null
  const body = value as { records?: unknown, cursor?: unknown, hasMore?: unknown }
  if (!Array.isArray(body.records)) return null
  if (typeof body.cursor != 'number' || !Number.isSafeInteger(body.cursor) || body.cursor < 0) return null
  if (typeof body.hasMore != 'boolean') return null
  const records: PlayRecord[] = []
  for (const record of body.records) {
    const wire = toWireRecord(record)
    if (wire) records.push(wire)
  }
  return { records, cursor: body.cursor, hasMore: body.hasMore }
}

const serverIdentity = async(): Promise<{ serverKey: string, userId: string } | null> => {
  const [mode, host, auth] = await Promise.all([getSyncMode(), getSyncHost(), getLuxAuth()])
  if (mode != 'lux') return null
  const userId = auth?.user?.id ?? ''
  if (!host || !userId) return null
  return { serverKey: `${host}\0${userId}`, userId }
}

const rememberCursor = async(identity: { serverKey: string, userId: string }, cursor: number, ackedIds: ReadonlySet<string>) => {
  const next: PlayHistoryCursor = {
    serverKey: identity.serverKey,
    userId: identity.userId,
    cursor,
    ackedIds: [...ackedIds],
  }
  await savePlayHistoryCursor(next)
}

/**
 * Lux sync only. Methods are message2call path segments, called after finished():
 *   playHistory:push { records } -> { accepted, ignored, cursor }
 *   playHistory:pull { since? } -> { records, cursor, hasMore }
 * An old server, or a server that replies "playHistory is not enabled", keeps the local store.
 */
export const syncPlayHistory = async(): Promise<void> => {
  if (unsupported || !isPlayHistoryFeatureEnabled()) return
  if (syncing) return syncing
  const socket = getReadySyncSocket()
  if (!socket) return
  const run = (async() => {
    const identity = await serverIdentity()
    if (!identity || !isPlayHistoryFeatureEnabled()) return
    const saved = getPlayHistoryCursor()
    const sameServer = saved != null && saved.serverKey == identity.serverKey && saved.userId == identity.userId
    let since = sameServer ? saved.cursor : undefined
    const acked = new Set<string>(sameServer ? saved.ackedIds : [])
    try {
      for (let page = 0; page < 200; page += 1) {
        const pulled = parsePull(await socket.remote[PLAY_HISTORY_PULL](since == null ? {} : { since }))
        if (!pulled) break
        if (pulled.records.length) {
          await replacePlayRecords(mergePlayRecords(getPlayRecords(), pulled.records))
          for (const record of pulled.records) acked.add(record.id)
        }
        const stalled = since != null && pulled.cursor == since
        since = pulled.cursor
        await rememberCursor(identity, pulled.cursor, acked)
        if (!pulled.hasMore || !pulled.records.length || stalled) break
      }
      const openId = getOpenPlaySessionId()
      const pending = getPlayRecords().filter(record => record.id != openId && !acked.has(record.id))
      for (const batch of chunkWireRecords(pending)) {
        await socket.remote[PLAY_HISTORY_PUSH]({ records: batch })
        for (const record of batch) acked.add(record.id)
        if (since != null) await rememberCursor(identity, since, acked)
      }
    } catch (error) {
      if (localOnlyMessage(error)) unsupported = true
      log.warn('play history sync skipped:', error instanceof Error ? error.message : error)
    }
  })()
  syncing = run
  try {
    await run
  } finally {
    if (syncing == run) syncing = null
  }
}

export const pushPlayRecord = (record: PlayRecord): void => {
  if (unsupported || !isPlayHistoryFeatureEnabled()) return
  const socket = getReadySyncSocket()
  if (!socket) return
  const wire = toWireRecord(record)
  if (!wire) return
  void (async() => {
    const identity = await serverIdentity()
    if (!identity || !isPlayHistoryFeatureEnabled()) return
    await socket.remote[PLAY_HISTORY_PUSH]({ records: [wire] })
    const saved = getPlayHistoryCursor()
    if (!saved || saved.serverKey != identity.serverKey || saved.userId != identity.userId) return
    if (saved.ackedIds.includes(wire.id)) return
    await savePlayHistoryCursor({ ...saved, ackedIds: [...saved.ackedIds, wire.id] })
  })().catch(error => {
    if (localOnlyMessage(error)) unsupported = true
    log.warn('play history push skipped:', error instanceof Error ? error.message : error)
  })
}

export const startPlayHistorySync = () => {
  if (started) return
  started = true
  onSyncSocketReady(() => {
    unsupported = false
    void syncPlayHistory()
  })
  AppState.addEventListener('change', (state) => {
    if (state == 'active') void syncPlayHistory()
  })
}
