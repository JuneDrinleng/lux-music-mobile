/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Wire fields mirror the together-chat/reaction/requests server protocol, v1. */
export const TOGETHER_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '👏'] as const
export interface RoomCapabilities { chat: boolean, reactions: boolean, requests: boolean, remoteRequests: boolean }
export const roomCapabilities = (features?: LX.Sync.SupportedFeatures, ready = false): RoomCapabilities => ({
  chat: ready && features?.['together.chat'] == 1,
  reactions: ready && features?.['together.reaction'] == 1,
  requests: ready && features?.['together.request'] == 1,
  // Device-command/MCP is a separate protocol; room requests never imply remote control.
  remoteRequests: false,
})
export const resolveTogetherLayout = (value: unknown): '6A' | '6B' => value == '6B' ? '6B' : '6A'

type Delivery = 'pending' | 'failed' | 'sent'
export interface ChatEntry {
  kind: 'chat'
  id: string
  message: Omit<LX.Sync.Together.ChatMessage, 'id'> & { id?: number }
  delivery: Delivery
  error?: string
}
export interface ReactionEntry { kind: 'reaction', id: string, at: number, reaction: LX.Sync.Together.ReactionPush }
export interface SystemEntry {
  kind: 'system'
  id: string
  at: number
  timeSource: 'server' | 'local'
  event: 'join' | 'leave' | 'songChange'
  memberId?: string
  song?: LX.Music.MusicInfoOnline | null
}
export interface RequestEntry {
  kind: 'request'
  id: string
  at: number
  request: LX.Sync.Together.SongRequest
  /** null: disappeared remotely, with no protocol evidence of the reason. */
  status: 'pending' | 'accepted' | 'played' | 'rejected' | null
}
export type TimelineEntry = ChatEntry | ReactionEntry | SystemEntry | RequestEntry
export interface RoomFeedState {
  roomId: string | null
  capabilities: RoomCapabilities
  entries: TimelineEntry[]
  members: LX.Sync.Together.Member[]
  pendingRequests: LX.Sync.Together.SongRequest[]
  playbackQueue: LX.Sync.Together.Queue | null
  requestIds: string[]
  requestsVersion: number
  beforeId?: number
  hasMore: boolean
  loading: boolean
  historyError?: string
}
type Actions = LX.Sync.ServerSyncTogetherActions
export type RoomFeedCall = <K extends keyof Actions>(method: K, ...args: Parameters<Actions[K]>) => ReturnType<Actions[K]>
const at = (entry: TimelineEntry) => entry.kind == 'chat' ? entry.message.at : entry.at
const sameSong = (a: LX.Music.MusicInfoOnline, b: LX.Music.MusicInfoOnline) => a.id == b.id && a.source == b.source
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error)
const initial = (): RoomFeedState => ({
  roomId: null,
  capabilities: roomCapabilities(),
  entries: [],
  members: [],
  pendingRequests: [],
  playbackQueue: null,
  requestIds: [],
  requestsVersion: 0,
  hasMore: true,
  loading: false,
})

/** Observable, bounded room window. Eviction never deletes permanent server history. */
export const createRoomFeed = (call: RoomFeedCall, options: { limit?: number, now?: () => number, clientId?: () => string } = {}) => {
  const limit = Math.max(1, Math.floor(options.limit ?? 500))
  const now = options.now ?? Date.now
  const nonce = Math.random().toString(36).slice(2)
  let sequence = 0
  let generation = 0
  let state = initial()
  let room: LX.Sync.Together.RoomSnapshot | null = null
  let selfId = ''
  const listeners = new Set<() => void>()
  const emit = () => { for (const listener of listeners) listener() }
  const update = (patch: Partial<RoomFeedState>) => { state = { ...state, ...patch }; emit() }
  const merge = (entries: TimelineEntry[], older = false) => {
    const byId = new Map(state.entries.map(entry => [entry.id, entry]))
    for (const entry of entries) byId.set(entry.id, entry)
    const all = [...byId.values()].sort((a, b) => {
      const pendingA = a.kind == 'chat' && a.delivery != 'sent'
      const pendingB = b.kind == 'chat' && b.delivery != 'sent'
      return Number(pendingA) - Number(pendingB) || at(a) - at(b) || (a.kind == 'chat' && b.kind == 'chat' ? (a.message.id ?? 0) - (b.message.id ?? 0) : 0) || a.id.localeCompare(b.id)
    })
    // Keep the requested window when paging backwards; keep local work when possible.
    const local = all.filter(entry => entry.kind == 'chat' && entry.delivery != 'sent').slice(-limit)
    const confirmed = all.filter(entry => !(entry.kind == 'chat' && entry.delivery != 'sent'))
    const capacity = limit - local.length
    update({ entries: [...(older ? confirmed.slice(0, capacity) : capacity ? confirmed.slice(-capacity) : []), ...local] })
  }
  const chat = (message: LX.Sync.Together.ChatMessage, older = false) => {
    if (message.roomId != state.roomId) return
    // Server id is authoritative. clientMsgId ties sender echo/ACK to optimistic work,
    // without assuming canonical senderId equals the credential alias of this device.
    const entries = state.entries.filter(entry => !(entry.kind == 'chat' && entry.delivery != 'sent' && entry.message.clientMsgId == message.clientMsgId))
    state = { ...state, entries }
    merge([{ kind: 'chat', id: `chat:${message.id}`, message, delivery: 'sent' }], older)
  }
  const reconcileQueue = () => {
    if (!room) return
    const queue = room.queue
    merge(state.entries.filter((entry): entry is RequestEntry => entry.kind == 'request').map(entry => {
      let status = entry.status
      if (status === null && queue.items.some(song => sameSong(song, entry.request.song))) status = 'accepted'
      if (status == 'accepted' && room?.playback.musicInfo && sameSong(room.playback.musicInfo, entry.request.song)) status = 'played'
      return { ...entry, status }
    }))
  }
  const requests = (push: LX.Sync.Together.RequestsPush) => {
    if (!state.capabilities.requests || push.roomId != state.roomId || push.version <= state.requestsVersion) return
    const ids = push.requests.map(request => `request:${request.id}`)
    const removed = state.entries.filter((entry): entry is RequestEntry => entry.kind == 'request' && entry.status == 'pending' && !ids.includes(entry.id))
    merge([
      ...removed.map(entry => ({ ...entry, status: null })),
      ...push.requests.map(request => ({ kind: 'request' as const, id: `request:${request.id}`, at: request.at, request, status: 'pending' as const })),
    ])
    update({ pendingRequests: push.requests, requestIds: ids, requestsVersion: push.version })
    reconcileQueue()
  }
  const setContext = (capabilities: RoomCapabilities, identity = selfId) => {
    // Invalidate outstanding operations across socket replacement or capability loss.
    const changed = Object.keys(capabilities).some(key => capabilities[key as keyof RoomCapabilities] != state.capabilities[key as keyof RoomCapabilities]) || identity != selfId
    if (changed) disconnect()
    selfId = identity
    update({ capabilities })
  }
  const disconnect = () => {
    generation++
    update({ capabilities: roomCapabilities(), loading: false, entries: state.entries.map(entry => entry.kind == 'chat' && entry.delivery == 'pending' ? { ...entry, delivery: 'failed', error: 'offline' } : entry) })
  }
  const setRoom = (snapshot: LX.Sync.Together.RoomSnapshot | null) => {
    if (snapshot?.roomId != state.roomId) {
      generation++
      state = { ...initial(), capabilities: state.capabilities }
    }
    room = snapshot
    update({ roomId: snapshot?.roomId ?? null, members: snapshot?.members ?? [], playbackQueue: snapshot?.queue ?? null })
    if (!snapshot) return
    if (state.capabilities.chat && snapshot.chat) {
      for (const message of snapshot.chat) chat(message)
      // Snapshot has no hasMore field: query history instead of assuming exhaustion.
    }
    if (snapshot.requests && snapshot.requestsVersion != null) requests({ roomId: snapshot.roomId, requests: snapshot.requests, version: snapshot.requestsVersion })
    reconcileQueue()
  }
  const loadOlder = async() => {
    if (!state.roomId || !state.capabilities.chat || state.loading || !state.hasMore) return
    const revision = generation
    update({ loading: true, historyError: undefined })
    try {
      const result = await call('together:chat:history', { roomId: state.roomId, beforeId: state.beforeId, limit: 50 })
      if (revision != generation) return
      if (!result.ok) throw new Error(result.message || result.code)
      for (const message of result.data.messages) chat(message, true)
      const ids = result.data.messages.filter(message => message.roomId == state.roomId).map(message => message.id)
      update({ beforeId: ids.length ? Math.min(state.beforeId ?? Infinity, ...ids) : state.beforeId, hasMore: result.data.hasMore && ids.length > 0 })
    } catch (error) {
      if (revision == generation) update({ historyError: errorText(error) })
    } finally {
      if (revision == generation) update({ loading: false })
    }
  }
  const sendPending = async(id: string) => {
    const entry = state.entries.find((item): item is ChatEntry => item.id == id && item.kind == 'chat')
    if (!entry || entry.delivery == 'sent' || !state.capabilities.chat) return
    const revision = generation
    merge([{ ...entry, delivery: 'pending', error: undefined }])
    try {
      const result = await call('together:chat:send', { text: entry.message.text, clientMsgId: entry.message.clientMsgId })
      if (revision != generation) return
      if (!result.ok) throw new Error(result.message || result.code)
      chat(result.data)
    } catch (error) {
      // An echo may have already confirmed the send before the transport failed.
      if (revision == generation && state.entries.some(item => item.id == id)) merge([{ ...entry, delivery: 'failed', error: errorText(error) }])
    }
  }
  const sending = new Set<string>()
  const retry = async(id: string) => {
    if (sending.has(id)) return
    sending.add(id)
    try { await sendPending(id) } finally { sending.delete(id) }
  }
  const sendChat = async(text: string) => {
    text = text.trim()
    if (!state.roomId || !state.capabilities.chat || !text || text.length > 500 || /[\x00-\x09\x0b-\x1f\x7f]/.test(text)) return null // eslint-disable-line no-control-regex
    const clientMsgId = options.clientId?.() ?? `${nonce}:${now()}:${++sequence}`
    const id = `local:${clientMsgId}`
    merge([{ kind: 'chat', id, delivery: 'pending', message: { roomId: state.roomId, senderId: selfId, displayName: state.members.find(member => member.memberId == selfId)?.displayName ?? '', text, at: now(), clientMsgId } }])
    await retry(id)
    return id
  }
  const reaction = (push: LX.Sync.Together.ReactionPush) => {
    if (state.capabilities.reactions && push.roomId == state.roomId) merge([{ kind: 'reaction', id: `reaction:${++sequence}`, at: push.at, reaction: push }])
  }
  const sendReaction = async(emoji: string) => {
    if (!state.roomId || !state.capabilities.reactions || !TOGETHER_REACTION_EMOJIS.some(item => item == emoji)) return false
    const result = await call('together:reaction', { emoji })
    return result.ok
  }
  const requestAction = async(action: 'approve' | 'reject' | 'remove', requestId: string) => {
    if (!room || !state.capabilities.requests) return false
    const revision = generation
    const target = state.entries.find((entry): entry is RequestEntry => entry.kind == 'request' && entry.request.id == requestId)
    const result = action == 'approve'
      ? await call('together:request:approve', { requestId, expectedQueueVersion: room.queueVersion })
      : action == 'reject' ? await call('together:request:reject', { requestId }) : await call('together:request:remove', { requestId })
    if (revision != generation || !result.ok) return false
    if (target) merge([{ ...target, status: action == 'approve' ? 'accepted' : action == 'reject' ? 'rejected' : null }])
    update({ pendingRequests: state.pendingRequests.filter(request => request.id != requestId), requestIds: state.requestIds.filter(id => id != `request:${requestId}`) })
    reconcileQueue()
    return true
  }
  const addRequest = async(song: LX.Music.MusicInfoOnline) => {
    if (!state.roomId || !state.capabilities.requests) return false
    return (await call('together:request:add', { song })).ok
  }
  const reorderRequests = async(requestIds: string[]) => {
    if (!room || !state.capabilities.requests || room.hostId != selfId) return false
    const current = state.requestIds.map(id => id.slice('request:'.length))
    if (requestIds.length != current.length || new Set(requestIds).size != current.length || requestIds.some(id => !current.includes(id))) return false
    return (await call('together:request:reorder', { requestIds })).ok
  }
  const system = (entry: SystemEntry) => { if (state.roomId) merge([entry]) }
  return { getSnapshot: () => state, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }, setContext, disconnect, setRoom, chat, requests, reaction, system, loadOlder, sendChat, retry, sendReaction, requestAction, addRequest, reorderRequests }
}

export const selectRoomTabs = (state: RoomFeedState) => ({
  chat: state.entries.filter(entry => entry.kind == 'system' || (entry.kind == 'chat' && state.capabilities.chat) || (entry.kind == 'reaction' && state.capabilities.reactions)),
  requests: selectRequestQueue(state),
  members: state.members,
})
export const selectRoomTimeline = (state: RoomFeedState) => state.entries.filter(entry => entry.kind == 'system' || (entry.kind == 'chat' && state.capabilities.chat) || (entry.kind == 'reaction' && state.capabilities.reactions) || (entry.kind == 'request' && state.capabilities.requests))
export const selectRequestQueue = (state: RoomFeedState): RequestEntry[] => state.capabilities.requests
  ? state.pendingRequests.map(request => ({ kind: 'request', id: `request:${request.id}`, at: request.at, request, status: 'pending' })) : []
export const selectRequestQueueModel = (state: RoomFeedState, selfId: string | null, hostId: string | null) => ({
  pending: selectRequestQueue(state),
  accepted: state.capabilities.requests ? state.entries.filter((entry): entry is RequestEntry => entry.kind == 'request' && entry.status == 'accepted') : [],
  playbackQueue: state.playbackQueue,
  canManage: state.capabilities.requests && selfId != null && selfId == hostId,
  canRequest: state.capabilities.requests && state.pendingRequests.length < 30 && state.pendingRequests.filter(request => request.requestedBy.memberId == selfId).length < 3,
  limits: { perMember: 3, perRoom: 30 },
})
