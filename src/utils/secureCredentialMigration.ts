/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { refreshTokenServerKey } from './secureCredentials'
import type { createSecureCredentials } from './secureCredentials'

/** Strip response/legacy secrets at every persistence boundary. */
export const withoutLuxSecrets = (auth: LX.Sync.LuxAuth): LX.Sync.LuxAuth => {
  const { refreshToken, password, ...safe } = auth as LX.Sync.LuxAuth & { password?: string }
  return safe
}

export const migrateLuxCredentials = async(deps: {
  read: () => Promise<{ active: LX.Sync.LuxAuth | null, sessions: Record<string, LX.Sync.LuxAuth> }>
  write: (active: LX.Sync.LuxAuth | null, sessions: Record<string, LX.Sync.LuxAuth>) => Promise<void>
  scrubPasswords: () => Promise<void>
  mark: () => Promise<void>
  secure: ReturnType<typeof createSecureCredentials>
}) => {
  const { active, sessions } = await deps.read()
  // The server map is authoritative; duplicate active records must not rotate it back.
  const tokens = new Map<string, string>()
  for (const auth of [...(active ? [active] : []), ...Object.values(sessions)]) {
    if (auth.refreshToken) tokens.set(refreshTokenServerKey(auth), auth.refreshToken)
  }
  // Upgrade installed v1 Keychain entries (server-only) once, using the
  // authoritative owner in the server map. Never lend one user's token to another.
  const owners = new Map<string, LX.Sync.LuxAuth>()
  if (active) owners.set(active.serverId ?? active.serverUrl ?? 'legacy', active)
  for (const [storedKey, auth] of Object.entries(sessions)) {
    const legacy = auth.serverId ?? auth.serverUrl ?? 'legacy'
    if (storedKey === legacy) owners.set(legacy, auth)
  }
  for (const [legacy, auth] of owners) {
    const key = refreshTokenServerKey(auth)
    if (key === legacy) continue
    const old = await deps.secure.getRefreshToken(legacy)
    if (old && !tokens.has(key) && !await deps.secure.getRefreshToken(key)) await deps.secure.setRefreshToken(key, old)
    if (old) await deps.secure.clear(legacy)
  }
  for (const [key, token] of tokens) await deps.secure.setRefreshToken(key, token)
  // Even failed native writes MUST discard plaintext. Access tokens may finish
  // their short lifetime; the next 401 uses the existing expired-session dialog.
  await deps.write(active ? withoutLuxSecrets(active) : null, Object.fromEntries(Object.entries(sessions).map(([key, auth]) => [key, withoutLuxSecrets(auth)])))
  await deps.scrubPasswords()
  await deps.mark()
}
