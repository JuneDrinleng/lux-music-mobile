/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'

const localDay = () => {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

// Memoized cards still refresh at local midnight and after a suspended app resumes.
export const useCoverDate = () => {
  const [day, setDay] = useState(localDay)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const refresh = () => {
      clearTimeout(timer)
      setDay(localDay())
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      timer = setTimeout(refresh, midnight.getTime() - now.getTime())
    }
    refresh()
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh()
    })
    return () => {
      clearTimeout(timer)
      subscription.remove()
    }
  }, [])
  return day
}
