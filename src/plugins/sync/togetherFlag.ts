/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Set from getEnabledFeatures. True only after this socket enabled Lux listen together. */
let enabled = false

export const setTogetherFeatureEnabled = (value: boolean) => {
  enabled = value
}

export const isTogetherFeatureEnabled = (): boolean => enabled
