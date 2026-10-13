/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getReadySyncSocket, onSyncSocketReady } from '@/plugins/sync/client/client'
import {
  TogetherUnavailableError,
  callTogether,
  getTogetherSelfId,
  setTogetherPushListener,
  type TogetherPush,
} from '@/plugins/sync/client/modules/together/api'
import { isTogetherFeatureEnabled } from '@/plugins/sync/togetherFlag'
import togetherActions from '@/store/together/action'
import togetherState from '@/store/together/state'
import { getSyncMode } from '@/utils/data'
import { log } from '@/utils/log'
import { toast } from '@/utils/tools'

import { startClockSync, stopClockSync } from './clock'
import { startHostReporting, stopHostReporting } from './host'
import { classifyPushVersion, isValidInviteCode, normalizeInviteCode } from './math'
import { applyPlayback, applyQueue, startMemberSync, stopMemberSync } from './member'

export type TogetherActionResult = { ok: true } | { ok: false, message: string }

let started = false
let lastVersion = 0
let refreshing: Promise<void> | null = null

const t = (key: string, params?: Record<string, string | number>) => global.i18n.t(key as Parameters<typeof global.i18n.t>[0], params)

const errorMessage = (code: LX.Sync.LuxErrorCode | null, message = ''): string => {
  switch (code) {
    case 'NOT_LUX_ACCOUNT': return t('together_need_lux')
    case 'ROOM_NOT_FOUND': return t('together_error_room_not_found')
    case 'ROOM_FULL': return t('together_error_room_full')
    case 'ROOM_LIMIT': return t('together_error_room_limit')
    case 'ALREADY_IN_ROOM': return t('together_error_already_in_room')
    case 'RATE_LIMITED': return t('together_error_rate_limited')
    case 'NOT_HOST': return t('together_error_not_host')
    case 'MEMBER_OFFLINE': return t('together_error_member_offline')
    case 'INVALID_PARAMS': return t('together_code_invalid')
    default: return t('together_error_generic', { message: message || String(code ?? '') })
  }
}

const thrownMessage = (error: unknown): string => {
  if (error instanceof TogetherUnavailableError) return getReadySyncSocket() ? t('together_unsupported') : t('together_offline')
  const message = error instanceof Error ? error.message : String(error ?? '')
  if (/together is not enabled/i.test(message)) return t('together_unsupported')
  return t('together_error_generic', { message })
}

const memberName = (memberId: string) => {
  const member = togetherState.room?.members.find(item => item.memberId == memberId)
  return member?.displayName ?? member?.username ?? ''
}

/** Start or stop host reporting / member following to match the current role. */
const syncRole = (previousRole: typeof togetherState.role, forceApply = false) => {
  const room = togetherState.room
  const role = togetherState.role
  if (!room || togetherState.connection != 'online') {
    stopHostReporting()
    stopMemberSync()
    return
  }
  if (role == 'host') {
    stopMemberSync()
    startHostReporting({
      onLostHost: () => {
        stopHostReporting()
        void refreshRoom()
      },
      onAck: (ack, kind) => {
        if (!togetherState.room) return
        if (kind == 'playback') togetherActions.patchRoom({ playbackVersion: ack.subVersion })
        else togetherActions.patchRoom({ queueVersion: ack.subVersion })
        // Only advance when nothing was missed; otherwise the next push detects the gap and resyncs.
        if (ack.version == lastVersion + 1) lastVersion = ack.version
      },
    })
    if (previousRole == 'member') toast(t('together_became_host'))
  } else {
    stopHostReporting()
    startMemberSync()
    if (forceApply || previousRole != 'member') void applyPlayback(room)
  }
}

const applySnapshot = (snapshot: LX.Sync.Together.RoomSnapshot) => {
  const previousRole = togetherState.role
  lastVersion = snapshot.version
  togetherActions.setRoom(snapshot, getTogetherSelfId())
  void startClockSync()
  syncRole(previousRole, true)
}

const clearRoom = (message?: string) => {
  const hadRoom = togetherState.room != null
  stopHostReporting()
  stopMemberSync()
  stopClockSync()
  lastVersion = 0
  togetherActions.setRoom(null)
  if (hadRoom && message) toast(message, 'long')
}

/** Full resync with getRoom(). A null room while we still think we are in one means it ended. */
export const refreshRoom = async(): Promise<void> => {
  if (refreshing) return refreshing
  const run = (async() => {
    try {
      const result = await callTogether('together:getRoom')
      if (!result.ok) {
        log.warn('together getRoom failed:', result.code, result.message)
        return
      }
      if (result.data) {
        applySnapshot(result.data)
      } else {
        clearRoom(t('together_room_closed'))
      }
    } catch (error) {
      log.warn('together getRoom error:', error instanceof Error ? error.message : error)
    }
  })()
  refreshing = run
  try {
    await run
  } finally {
    // eslint-disable-next-line require-atomic-updates
    refreshing = null
  }
}

const handlePush = (event: TogetherPush) => {
  const room = togetherState.room
  if (!room || event.push.roomId != room.roomId) return
  if (event.type == 'roomClosed') {
    clearRoom(t('together_room_closed'))
    return
  }
  const decision = classifyPushVersion(lastVersion, event.push.version)
  if (decision == 'stale') return
  lastVersion = event.push.version
  const previousRole = togetherState.role
  switch (event.type) {
    case 'roomState': {
      const { push } = event
      togetherActions.patchRoom({
        version: push.version,
        playbackVersion: push.playbackVersion,
        playback: push.playback,
        queueVersion: push.queueVersion,
        ...(push.queue ? { queue: push.queue } : {}),
      })
      const next = togetherState.room
      if (next && togetherState.role == 'member' && togetherState.connection == 'online') {
        void applyPlayback(next).then(() => {
          if (push.queue && togetherState.room) void applyQueue(togetherState.room)
        })
      }
      break
    }
    case 'memberChanged': {
      const { push } = event
      const selfId = togetherState.selfId
      if (push.change.type == 'leave' && push.change.memberId == selfId) {
        clearRoom(t('together_removed'))
        return
      }
      const joinedName = push.change.type == 'join' ? push.members.find(m => m.memberId == push.change.memberId)?.displayName : null
      const leftName = push.change.type == 'leave' ? memberName(push.change.memberId) : null
      togetherActions.patchRoom({ version: push.version, members: push.members })
      if (joinedName) toast(t('together_member_joined', { name: joinedName }))
      if (leftName) toast(t('together_member_left', { name: leftName }))
      break
    }
    case 'hostChanged': {
      const { push } = event
      togetherActions.patchRoom({ version: push.version, hostId: push.hostId })
      syncRole(previousRole)
      break
    }
  }
  if (decision == 'gap') void refreshRoom()
}

const handleSocketReady = () => {
  const socket = getReadySyncSocket()
  if (!socket) return
  if (!isTogetherFeatureEnabled()) {
    togetherActions.setConnection('unsupported')
    if (togetherState.room) clearRoom(t('together_room_closed'))
    return
  }
  togetherActions.setConnection('online')
  socket.onClose(() => {
    togetherActions.setConnection('offline')
    stopHostReporting()
    stopMemberSync()
    stopClockSync()
  })
  void refreshRoom()
}

const ensureOnline = async(): Promise<string | null> => {
  if (await getSyncMode().catch(() => 'lx') != 'lux') return t('together_need_lux')
  if (!getReadySyncSocket()) return t('together_offline')
  if (!isTogetherFeatureEnabled()) return t('together_unsupported')
  return null
}

const withPending = async(fn: () => Promise<TogetherActionResult>): Promise<TogetherActionResult> => {
  if (togetherState.pending) return { ok: false, message: '' }
  togetherActions.setPending(true)
  try {
    return await fn()
  } catch (error) {
    return { ok: false, message: thrownMessage(error) }
  } finally {
    togetherActions.setPending(false)
  }
}

export const createTogetherRoom = async(): Promise<TogetherActionResult> => withPending(async() => {
  const blocked = await ensureOnline()
  if (blocked) return { ok: false, message: blocked }
  const result = await callTogether('together:createRoom')
  if (!result.ok) {
    if (result.code == 'ALREADY_IN_ROOM') await refreshRoom()
    return { ok: false, message: errorMessage(result.code, result.message) }
  }
  applySnapshot(result.data)
  return { ok: true }
})

export const joinTogetherRoom = async(input: string): Promise<TogetherActionResult> => {
  const code = normalizeInviteCode(input)
  if (!isValidInviteCode(code)) return { ok: false, message: t('together_code_invalid') }
  return withPending(async() => {
    const blocked = await ensureOnline()
    if (blocked) return { ok: false, message: blocked }
    const result = await callTogether('together:joinRoom', { code })
    if (!result.ok) {
      if (result.code == 'ALREADY_IN_ROOM') await refreshRoom()
      return { ok: false, message: errorMessage(result.code, result.message) }
    }
    applySnapshot(result.data)
    return { ok: true }
  })
}

export const leaveTogetherRoom = async(): Promise<TogetherActionResult> => withPending(async() => {
  const room = togetherState.room
  if (!room) return { ok: true }
  try {
    const result = await callTogether('together:leaveRoom', { roomId: room.roomId })
    if (!result.ok && result.code != 'NOT_IN_ROOM') return { ok: false, message: errorMessage(result.code, result.message) }
  } catch (error) {
    // Offline: drop the room locally; the server removes us after the grace period.
    log.warn('together leaveRoom error:', error instanceof Error ? error.message : error)
  }
  clearRoom()
  return { ok: true }
})

export const closeTogetherRoom = async(): Promise<TogetherActionResult> => withPending(async() => {
  const room = togetherState.room
  if (!room) return { ok: true }
  const result = await callTogether('together:closeRoom', { roomId: room.roomId })
  if (!result.ok && result.code != 'NOT_IN_ROOM') return { ok: false, message: errorMessage(result.code, result.message) }
  clearRoom()
  return { ok: true }
})

export const transferTogetherHost = async(memberId: string): Promise<TogetherActionResult> => withPending(async() => {
  const room = togetherState.room
  if (!room) return { ok: true }
  const result = await callTogether('together:transferHost', { roomId: room.roomId, memberId })
  if (!result.ok) return { ok: false, message: errorMessage(result.code, result.message) }
  return { ok: true }
})

export const initTogether = () => {
  if (started) return
  started = true
  setTogetherPushListener(handlePush)
  onSyncSocketReady(handleSocketReady)
  global.app_event.on('syncModeUpdated', (mode: LX.Sync.Mode) => {
    if (mode != 'lux') clearRoom()
  })
}
