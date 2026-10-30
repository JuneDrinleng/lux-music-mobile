/** Onboarding always uses Lux; an explicit host must not override a saved LX mode. */
export const resolveSyncLoginEntry = (onboarding: boolean, mode: 'lx' | 'lux', initialHost: string, savedHost: string) => ({
  legacy: !onboarding && mode === 'lx',
  host: initialHost || (onboarding ? '' : savedHost),
})

export const syncLoginExitTarget = (onboarding: boolean) => onboarding ? 'onboarding' : 'home'
