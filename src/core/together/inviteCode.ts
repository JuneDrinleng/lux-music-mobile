/** Share text is untrusted. Routing is explicit; the server remains authoritative. */
export interface TogetherInvite {
  code: string
  serverId: string
  roomId: string
  expiresAt?: number
  host?: string
  song?: string
  members?: number
}
const normalize = (value: string) => value.normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g, '')
export const validInvite = (value: TogetherInvite, now = Date.now()): boolean => (
  value != null && typeof value == 'object' && typeof value.code == 'string' && /^[1-9]\d{5}$/.test(value.code) && typeof value.serverId == 'string' && value.serverId.length > 0 && value.serverId.length <= 512 &&
  typeof value.roomId == 'string' && value.roomId.length > 0 && value.roomId.length <= 128 &&
  (value.expiresAt == null || (Number.isFinite(value.expiresAt) && value.expiresAt > now)) &&
  [value.host, value.song].every(text => text == null || (typeof text == 'string' && text.length <= 256)) &&
  (value.members == null || (Number.isInteger(value.members) && value.members >= 0 && value.members <= 10000))
)
export const inviteIdentity = (value: TogetherInvite): string => JSON.stringify([value.serverId, value.roomId, value.code])
export const formatInviteToken = (value: TogetherInvite): string => {
  if (!validInvite(value)) throw new Error('Invalid invite')
  return `₤LX${value.code}-${encodeURIComponent(JSON.stringify([value.code, value.serverId, value.roomId, value.expiresAt ?? null, value.host ?? null, value.song ?? null, value.members ?? null]))}₤`
}
export const formatInviteText = (value: TogetherInvite, displayText = ''): string => `${displayText}${displayText ? ' ' : ''}${formatInviteToken(value)}`
export const parseInviteText = (text: string, now = Date.now()): TogetherInvite | null => {
  if (text.length > 65536) return null
  const normalized = normalize(text).replace(/\s+/g, '')
  for (const match of normalized.matchAll(/₤LX([1-9]\d{5})-([^₤]+)₤/gi)) {
    try {
      const fields: unknown = JSON.parse(decodeURIComponent(match[2]))
      if (!Array.isArray(fields) || fields.length !== 7 || fields[0] !== match[1]) continue
      const value: TogetherInvite = {
        code: match[1],
        serverId: fields[1],
        roomId: fields[2],
        ...(fields[3] != null ? { expiresAt: fields[3] } : {}),
        ...(fields[4] != null ? { host: fields[4] } : {}),
        ...(fields[5] != null ? { song: fields[5] } : {}),
        ...(fields[6] != null ? { members: fields[6] } : {}),
      }
      if (value && value.code === match[1] && validInvite(value, now)) return value
    } catch {}
  }
  return null
}
export interface PendingInvite { invite: TogetherInvite, accepted: boolean }
export interface InviteGate { loggedIn: boolean, connected: boolean, serverId?: string, currentRoomId?: string, busy?: boolean, supported?: boolean }
export const pendingInviteDecision = (pending: PendingInvite | null, gate: InviteGate, now = Date.now()): 'empty' | 'expired' | 'hold' | 'joined' | 'join' => {
  if (!pending) return 'empty'
  if (!validInvite(pending.invite, now)) return 'expired'
  if (!pending.accepted || !gate.loggedIn || !gate.connected || gate.supported === false || gate.serverId !== pending.invite.serverId || gate.busy) return 'hold'
  if (gate.currentRoomId === pending.invite.roomId) return 'joined'
  // Do not silently abandon an existing room.
  if (gate.currentRoomId) return 'hold'
  return 'join'
}
