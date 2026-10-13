/** Visual-only dots when a saved secret is present but the input value is empty. */
export const SYNC_LOGIN_SAVED_SECRET_MASK = '••••••'

export const syncLoginSavedSecretDisplayValue = (
  secret: string,
  shouldShowSavedMask: boolean,
  savedMaskVisible: boolean,
): string => {
  if (secret) return secret
  if (shouldShowSavedMask && savedMaskVisible) return SYNC_LOGIN_SAVED_SECRET_MASK
  return ''
}

export const syncLoginSavedSecretInputValue = (
  nextValue: string,
  previousDisplayValue: string,
): string => {
  if (nextValue === SYNC_LOGIN_SAVED_SECRET_MASK) return ''
  if (
    previousDisplayValue === SYNC_LOGIN_SAVED_SECRET_MASK &&
    nextValue.startsWith(SYNC_LOGIN_SAVED_SECRET_MASK)
  ) {
    return nextValue.slice(SYNC_LOGIN_SAVED_SECRET_MASK.length)
  }
  return nextValue
}
