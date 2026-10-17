/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export interface ServerInfo {
  name: string
  version: string
  minClientVersion: string | null
  registration: { enabled: boolean, inviteOnly: boolean }
}
export interface ServerCheckState {
  status: 'idle' | 'checking' | 'ok' | 'failed'
  requestId: number
  url: string
  reachable: boolean | null
  compatible: boolean | null
  https: boolean | null
  registration: ServerInfo['registration'] | null
  latency: number | null
  info: ServerInfo | null
  error?: 'invalid' | 'unreachable' | 'timeout' | 'incompatible'
}
export const initialServerCheck: ServerCheckState = {
  status: 'idle',
  requestId: 0,
  url: '',
  reachable: null,
  compatible: null,
  https: null,
  registration: null,
  latency: null,
  info: null,
}

export const normalizeServerUrl = (input: string): string => {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const value = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  // Avoid URL's incomplete implementation on older React Native versions.
  const match = /^(https?):\/\/([^/?#\s]+)(\/[^?#\s]*)?\/*$/i.exec(value)
  if (!match || match[2].includes('@') || /[^\w.:[\]-]/.test(match[2])) return ''
  const authority = /^(\[[a-f\d:]+\]|[\w.-]+)(?::(\d+))?$/i.exec(match[2])
  if (!authority || (authority[2] && (+authority[2] < 1 || +authority[2] > 65535))) return ''
  return `${match[1].toLowerCase()}://${match[2].toLowerCase()}${match[3] ?? ''}`.replace(/\/+$/, '')
}

// Semantic release comparison, including development/prerelease clients.
export const versionAtLeast = (actual: string, minimum: string): boolean => {
  const parse = (value: string) => /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([\w.-]+))?(?:\+[\w.-]+)?$/.exec(value)
  const a = parse(actual)
  const b = parse(minimum)
  if (!a || !b) return false
  for (let i = 1; i <= 3; i++) {
    const diff = Number(a[i] ?? 0) - Number(b[i] ?? 0)
    if (diff) return diff > 0
  }
  if (!a[4] || !b[4]) return !a[4] || Boolean(b[4])
  const left = a[4].split('.')
  const right = b[4].split('.')
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i] === right[i]) continue
    if (left[i] == null || right[i] == null) return right[i] == null
    const numericLeft = /^\d+$/.test(left[i])
    const numericRight = /^\d+$/.test(right[i])
    if (numericLeft && numericRight) return +left[i] > +right[i]
    if (numericLeft !== numericRight) return numericRight
    return left[i] > right[i]
  }
  return true
}

type Event =
  | { type: 'input' | 'check', requestId: number, url: string }
  | { type: 'result', requestId: number, info: ServerInfo, latency: number, clientVersion: string }
  | { type: 'error', requestId: number, error: 'invalid' | 'unreachable' | 'timeout' }

export const serverCheckReducer = (state: ServerCheckState, event: Event): ServerCheckState => {
  if (event.type === 'input' || event.type === 'check') {
    return { ...initialServerCheck, requestId: event.requestId, url: event.url, https: event.url ? event.url.startsWith('https://') : null, status: event.type === 'check' ? 'checking' : 'idle' }
  }
  if (event.requestId !== state.requestId || state.status !== 'checking') return state
  if (event.type === 'error') return { ...state, status: 'failed', reachable: false, error: event.error }
  if (event.type !== 'result') return state
  const compatible = event.info.minClientVersion == null || versionAtLeast(event.clientVersion, event.info.minClientVersion)
  return {
    ...state,
    status: compatible ? 'ok' : 'failed',
    reachable: true,
    compatible,
    info: event.info,
    registration: event.info.registration,
    latency: event.latency,
    error: compatible ? undefined : 'incompatible',
  }
}

export const parseServerInfo = (value: unknown): ServerInfo => {
  const info = value as Partial<ServerInfo> | null
  if (!info || typeof info.name !== 'string' || typeof info.version !== 'string' ||
    !(info.minClientVersion === null || typeof info.minClientVersion === 'string') ||
    typeof info.registration?.enabled !== 'boolean' || typeof info.registration.inviteOnly !== 'boolean') throw new Error('Invalid server-info')
  return info as ServerInfo
}

/** Effect driver; reducer and all dependencies remain independent of React/native APIs. */
export const createServerChecker = ({ request, clientVersion, onChange, debounceMs = 500, timeoutMs = 10000, now = Date.now }: {
  request: (url: string, signal: AbortSignal) => Promise<ServerInfo>
  clientVersion: string
  onChange: (state: ServerCheckState) => void
  debounceMs?: number
  timeoutMs?: number
  now?: () => number
}) => {
  let state = initialServerCheck
  let generation = 0
  let debounce: ReturnType<typeof setTimeout> | undefined
  let timeout: ReturnType<typeof setTimeout> | undefined
  let controller: AbortController | undefined
  const dispatch = (event: Event) => { state = serverCheckReducer(state, event); onChange(state) }
  const cancel = () => {
    generation++
    clearTimeout(debounce)
    clearTimeout(timeout)
    controller?.abort()
  }
  const check = async(input: string) => {
    cancel()
    const requestId = generation
    const url = normalizeServerUrl(input)
    dispatch({ type: 'check', requestId, url })
    if (!url) { dispatch({ type: 'error', requestId, error: 'invalid' }); return }
    const active = new AbortController()
    controller = active
    const started = now()
    timeout = setTimeout(() => {
      if (requestId !== generation) return
      dispatch({ type: 'error', requestId, error: 'timeout' })
      active.abort()
    }, timeoutMs)
    try {
      const info = await request(`${url}/api/server-info`, active.signal)
      if (requestId === generation && state.status === 'checking') dispatch({ type: 'result', requestId, info, latency: Math.max(0, now() - started), clientVersion })
    } catch {
      if (requestId === generation && state.status === 'checking') dispatch({ type: 'error', requestId, error: 'unreachable' })
    } finally {
      if (requestId === generation) clearTimeout(timeout)
    }
  }
  return {
    input: (input: string) => {
      cancel()
      dispatch({ type: 'input', requestId: generation, url: normalizeServerUrl(input) })
      if (input.trim()) debounce = setTimeout(() => { void check(input) }, debounceMs)
    },
    check,
    dispose: cancel,
  }
}
