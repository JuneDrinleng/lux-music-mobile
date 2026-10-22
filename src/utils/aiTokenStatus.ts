/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export interface AiToken { id: string, name: string, scopes: string[], lastUsedAt: number | null, expiresAt: number | null, revokedAt: number | null }
export interface AiOperation { at: number, action: string, summary: string, ok: boolean, tokenId: string }
export type AiStatus = { kind: 'ready', tokens: AiToken[], operations: AiOperation[] } | { kind: 'local' | 'signedOut' | 'unsupported' | 'error' | 'timeout' }
type Request = <T>(url: string, body?: unknown, token?: string, method?: string) => Promise<T>
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
const timestamp = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0
const nullableTime = (value: unknown) => value === null || timestamp(value)
export const parseAiTokens = (value: unknown, now: number): AiToken[] => {
  if (!record(value) || !Array.isArray(value.tokens)) throw new Error('Invalid tokens response')
  return value.tokens.map((item: unknown) => {
    if (!record(item) || typeof item.id !== 'string' || !item.id || typeof item.name !== 'string' || !Array.isArray(item.scopes) || !item.scopes.every(s => typeof s === 'string') || !nullableTime(item.lastUsedAt) || !nullableTime(item.expiresAt) || !nullableTime(item.revokedAt)) throw new Error('Invalid token metadata')
    return { id: item.id, name: item.name, scopes: item.scopes, lastUsedAt: item.lastUsedAt as number | null, expiresAt: item.expiresAt as number | null, revokedAt: item.revokedAt as number | null }
  }).filter(item => item.revokedAt === null && (item.expiresAt === null || item.expiresAt > now)).sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
}
export const parseAiOperations = (value: unknown, tokenId: string): AiOperation[] => {
  if (!record(value) || !Array.isArray(value.items)) throw new Error('Invalid activity response')
  return value.items.map((item: unknown) => {
    if (!record(item) || !timestamp(item.at) || typeof item.action !== 'string' || typeof item.summary !== 'string' || typeof item.ok !== 'boolean') throw new Error('Invalid activity')
    return { at: item.at as number, action: item.action, summary: item.summary, ok: item.ok, tokenId }
  })
}
// Account session JWT, never a personal access token. Contract: server/api/pats.ts.
export const createAiTokenClient = (request: Request, host: string, token: string) => ({
  list: async(now: number) => parseAiTokens(await request<unknown>(`${host.replace(/\/$/, '')}/api/me/tokens`, undefined, token), now),
  activity: async(id: string) => parseAiOperations(await request<unknown>(`${host.replace(/\/$/, '')}/api/me/tokens/${encodeURIComponent(id)}/activity?limit=50`, undefined, token), id),
})
export const loadAiTokenStatus = async(deps: {
  local: boolean
  session: () => Promise<{ token: string } | null>
  request: Request
  host: string
  now?: number
  timeoutMs?: number
}): Promise<AiStatus> => {
  if (deps.local || !deps.host.trim()) return { kind: 'local' }
  let timer: ReturnType<typeof setTimeout> | undefined
  let ended = false
  const work = async(): Promise<AiStatus> => {
    const auth = await deps.session()
    if (ended) return { kind: 'timeout' }
    if (!auth) return { kind: 'signedOut' }
    const client = createAiTokenClient(deps.request, deps.host, auth.token)
    const tokens = await client.list(deps.now ?? Date.now())
    const operations: AiOperation[] = []
    // Bound concurrency and stop issuing requests after the overall deadline.
    let next = 0
    await Promise.all(Array.from({ length: Math.min(4, tokens.length) }, async() => {
      while (next < tokens.length) {
        if (ended) break
        operations.push(...await client.activity(tokens[next++].id))
      }
    }))
    return { kind: 'ready', tokens, operations: operations.sort((a, b) => b.at - a.at).slice(0, 50) }
  }
  try {
    return await Promise.race([work(), new Promise<AiStatus>(resolve => {
      timer = setTimeout(() => { ended = true; resolve({ kind: 'timeout' }) }, deps.timeoutMs ?? 10000)
    })])
  } catch (error) {
    const status = (error as { status?: number }).status
    return { kind: status === 404 || status === 501 ? 'unsupported' : 'error' }
  } finally { ended = true; clearTimeout(timer) }
}
export const aiRelativeTime = (at: number | null, now: number) => {
  if (at === null) return { key: 'ai_tokens_never' as const }
  const minutes = Math.floor(Math.max(0, now - at) / 60000)
  if (!minutes) return { key: 'ai_tokens_just_now' as const }
  if (minutes < 60) return { key: 'ai_tokens_minutes' as const, count: minutes }
  if (minutes < 1440) return { key: 'ai_tokens_hours' as const, count: Math.floor(minutes / 60) }
  return { key: 'ai_tokens_days' as const, count: Math.floor(minutes / 1440) }
}
const actions = {
  'playlist.list': 'list',
  'playlist.read': 'read',
  'playlist.create': 'create',
  'playlist.addSongs': 'add',
  'playlist.removeSongs': 'remove',
  'history.read': 'history',
  'stats.topTracks': 'top',
  'token.whoami': 'identity',
  'mcp.list_playlists': 'list',
  'mcp.get_playlist': 'read',
  'mcp.create_playlist': 'create',
  'mcp.add_songs_to_playlist': 'add',
  'mcp.get_listening_history': 'history',
  'mcp.get_top_tracks': 'top',
  'mcp.list_devices': 'devices',
  'mcp.play_on_device': 'play',
  'mcp.control_playback': 'control',
} as const
export const aiOperationKey = (action: string) => `ai_tokens_op_${actions[action as keyof typeof actions] ?? 'unknown'}` as `ai_tokens_op_${typeof actions[keyof typeof actions] | 'unknown'}`
const scopes = { 'playlist:read': 'ai_tokens_scope_read', 'playlist:write': 'ai_tokens_scope_write', 'history:read': 'ai_tokens_scope_history', 'player:control': 'ai_tokens_scope_player', 'together:request': 'ai_tokens_scope_together' } as const
export const aiScopeKey = (scope: string) => scopes[scope as keyof typeof scopes] ?? 'ai_tokens_scope_unknown'
export const aiScopeKeys = (permissions: string[]) => {
  const combined = permissions.includes('playlist:read') && permissions.includes('history:read')
  return combined ? ['ai_tokens_scope_read_history' as const, ...permissions.filter(scope => scope !== 'playlist:read' && scope !== 'history:read').map(aiScopeKey)] : permissions.map(aiScopeKey)
}
export const aiOperationTime = (at: number, now: number) => {
  const date = new Date(at)
  const today = new Date(now)
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  const sameDay = (other: Date) => date.getFullYear() === other.getFullYear() && date.getMonth() === other.getMonth() && date.getDate() === other.getDate()
  return { day: sameDay(today) ? 'ai_tokens_today' as const : sameDay(yesterday) ? 'ai_tokens_yesterday' as const : null, date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`, time: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}` }
}
