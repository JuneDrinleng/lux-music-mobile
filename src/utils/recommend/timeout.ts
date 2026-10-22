/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
/** Includes queue/storage waits, not just catalog calls. Observe late rejections. */
export const withRecommendationTimeout = async<T>(work: Promise<T>, timeoutMs = 9000, onTimeout?: () => void): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work,
      new Promise<never>((resolve, reject) => {
        timer = setTimeout(() => { onTimeout?.(); reject(new Error('Recommendation load timed out')) }, Math.max(1, timeoutMs))
      }),
    ])
  } finally { if (timer) clearTimeout(timer) }
}
