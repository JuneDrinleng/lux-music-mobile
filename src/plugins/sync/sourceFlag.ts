/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Set from getEnabledFeatures. True only after this socket enabled Lux server-side source resolution. */
let enabled = false

export const setSourceFeatureEnabled = (value: boolean) => {
  enabled = value
}

export const isSourceFeatureEnabled = (): boolean => enabled
