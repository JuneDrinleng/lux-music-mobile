import { bootTimestamp, perfEnabled } from '@/utils/perfDiagnostics'

const logs: string[] = []


export const bootLog = (...msgs: any[]) => {
  const atMs = bootTimestamp(typeof msgs[0] === 'string' ? msgs[0] : 'bootLog')
  logs.push((perfEnabled ? `[+${atMs.toFixed(1)}ms] ` : '') + msgs.map(m => typeof m == 'string' ? m : JSON.stringify(m)).join(' '))
}

export const getBootLog = () => {
  return logs.join('\n')
}

