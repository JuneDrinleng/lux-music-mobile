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
  for (const [key, token] of tokens) await deps.secure.setRefreshToken(key, token)
  // Even failed native writes MUST discard plaintext. Access tokens may finish
  // their short lifetime; the next 401 uses the existing expired-session dialog.
  await deps.write(active ? withoutLuxSecrets(active) : null, Object.fromEntries(Object.entries(sessions).map(([key, auth]) => [key, withoutLuxSecrets(auth)])))
  await deps.scrubPasswords()
  await deps.mark()
}
