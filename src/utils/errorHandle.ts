/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

// import { exitApp } from '@/utils/common'
import { setJSExceptionHandler, setNativeExceptionHandler } from 'react-native-exception-handler'
import { log } from '@/utils/log'
import { tipDialog, toast } from './tools'

const errorHandler = (e: Error, isFatal: boolean) => {
  const excludedErrors = [
    'Failed to construct \'Response\'',
  ]
  if (isFatal) {
    if (excludedErrors.includes(e.message)) {
      toast('应用遇到异常，如可复现请截图并到 GitHub 反馈，同时附上错误日志。')
    } else {
      void tipDialog({
        title: 'Unexpected error occurred',
        message: `
应用遇到异常，请截图并反馈到 GitHub。
如出现功能异常，请强制结束应用后重新启动。

Error:
${isFatal ? 'Fatal:' : ''} ${e.name} ${e.message}
`,
        btnText: 'Close',
      })
    }
  }
  log.error(e.stack)
}

if (process.env.NODE_ENV !== 'development') {
  setJSExceptionHandler(errorHandler)

  setNativeExceptionHandler((errorString) => {
    log.error(errorString)
    console.log('+++++', errorString, '+++++')
  }, false)
}
