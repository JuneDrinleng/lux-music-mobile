/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Kept independent of native modules so background/media entry points share one fence.
let generation = 0
let frozen = false
let preparedSync = false
export const sessionGeneration = () => generation
export const sessionWritesFrozen = () => frozen
export const freezeSession = () => { frozen = true; preparedSync = false; return ++generation }
export const releaseSession = () => { frozen = false; preparedSync = false }
export const acceptsSessionGeneration = (ticket: number) => ticket === generation

// Chosen once before the first transaction. A pending journal always forces recovery via the coordinator.
let coordinatorEnabled = true
export const isSessionCoordinatorEnabled = () => coordinatorEnabled
export const selectSessionCoordinator = (enabled: boolean) => { if (!frozen) coordinatorEnabled = enabled }

export const sessionRemoteWritesFrozen = () => frozen && !preparedSync
export const allowPreparedSessionSync = () => { preparedSync = true }
export const stopPreparedSessionSync = () => { preparedSync = false }
