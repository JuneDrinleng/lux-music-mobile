/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { getData, saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { updateSetting } from '@/core/common'
import { setSyncLoginCompleted } from '@/utils/data'

const completedKey = 'onboardingCompleted@v1'
export const shouldShowOnboarding = (completed: boolean, acceptedAgreement: boolean, seenSafetyNotice: boolean): boolean =>
  !completed && !acceptedAgreement && !seenSafetyNotice
export const getOnboardingCompleted = async(): Promise<boolean> => (await getData<boolean>(completedKey)) === true
export const completeOnboarding = async(): Promise<void> => {
  // Persist acceptance only on completion so interrupted new installs resume the flow.
  updateSetting({ 'common.isAgreePact': true })
  await saveData(storageDataPrefix.cheatTip, true)
  await setSyncLoginCompleted(true)
  await saveData(completedKey, true)
}
