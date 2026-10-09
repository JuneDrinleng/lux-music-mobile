/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Set from getEnabledFeatures. True only after this socket enabled Lux play history. */
let enabled = false

export const setPlayHistoryFeatureEnabled = (value: boolean) => {
  enabled = value
}

export const isPlayHistoryFeatureEnabled = (): boolean => enabled
