import { inviteIdentity, parseInviteText, pendingInviteDecision, validInvite, type InviteGate, type PendingInvite, type TogetherInvite } from './inviteCode'

export interface InvitePreferences { disabled: boolean, ignored: string[], pending: PendingInvite | null }
export const createInviteController = (deps: {
  load: () => Promise<InvitePreferences | null>
  save: (value: InvitePreferences) => Promise<void>
  read: () => Promise<string>
  gate: () => Promise<InviteGate>
  join: (invite: TogetherInvite) => Promise<boolean>
  changed: (invite: TogetherInvite | null) => void
}) => {
  let state: InvitePreferences = { disabled: false, ignored: [], pending: null }
  let ready: Promise<void> | null = null
  let running = false
  let foreground = false
  let reading = false
  let foregroundRevision = 0
  const init = async() => {
    ready ??= deps.load().then(value => {
      if (!value) return
      state = { disabled: Boolean(value.disabled), ignored: Array.isArray(value.ignored) ? value.ignored.filter(key => typeof key == 'string') : [], pending: value.pending && validInvite(value.pending.invite) ? value.pending : null }
    })
    return ready
  }
  let writes = Promise.resolve()
  const save = async() => {
    const snapshot = { ...state, ignored: [...state.ignored] }
    writes = writes.catch(() => {}).then(async() => deps.save(snapshot))
    await writes
  }
  const pump = async() => {
    await init()
    if (running || !foreground) return
    running = true
    try {
      const pending = state.pending
      const gate = await deps.gate()
      if (!foreground) return
      if (gate.supported === false) { deps.changed(null); return }
      const decision = pendingInviteDecision(pending, gate)
      if (!pending) { deps.changed(null); return }
      if (decision == 'join') {
        // Clear before RPC: a rejected join never loops on store notifications.
        state.pending = null
        await save()
        const joined = await deps.join(pending.invite).catch(() => false)
        if (joined) {
          state.ignored = [...new Set([...state.ignored, inviteIdentity(pending.invite)])]
          await save()
        } else {
          state.pending = { ...pending, accepted: false }
          await save()
          if (foreground) deps.changed(pending.invite)
        }
      } else if (decision == 'joined' || decision == 'expired') {
        state.ignored = [...new Set([...state.ignored, inviteIdentity(pending.invite)])]
        state.pending = null
        await save()
        deps.changed(null)
      } else if (!pending.accepted) deps.changed(pending.invite)
    } finally {
      // eslint-disable-next-line require-atomic-updates
      running = false
    }
  }
  const dismiss = async(disable = false) => {
    await init()
    if (state.pending) state.ignored = [...new Set([...state.ignored, inviteIdentity(state.pending.invite)])]
    state.pending = null
    state.disabled ||= disable
    deps.changed(null)
    await save()
  }
  return {
    pump,
    dismiss,
    accept: async() => {
      await init()
      if (!state.pending) return
      state.pending = { ...state.pending, accepted: true }
      deps.changed(null)
      await save()
      await pump()
    },
    foreground: async(active: boolean) => {
      const revision = ++foregroundRevision
      foreground = active
      if (!active) { deps.changed(null); return }
      await init()
      await pump()
      if (!foreground || reading || state.disabled || state.pending) return
      if ((await deps.gate()).supported === false || !foreground || reading) return
      reading = true
      try {
        const invite = parseInviteText(await deps.read())
        if (!foreground || revision !== foregroundRevision || !invite || state.ignored.includes(inviteIdentity(invite))) return
        state.pending = { invite, accepted: false }
        await save()
        await pump()
      } finally {
        // eslint-disable-next-line require-atomic-updates
        reading = false
      }
    },
  }
}
