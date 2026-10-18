/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { retryDelayMs } from '@/utils/syncStatus'
import { encryptMsg, decryptMsg } from './utils'
import { callObj } from './sync'
// import { action as commonAction } from '@/store/modules/common'
// import { getStore } from '@/store'
// import registerSyncListHandler from './syncList'
import log from '../log'
import { aesEncrypt } from '../utils'
import { setSyncStatus } from '@/core/sync'
import { dateFormat } from '@/utils/common'
import { createMsg2call } from 'message2call'
import { SYNC_CLOSE_CODE, SYNC_CODE } from '../constants'
import { isPlayHistoryFeatureEnabled, setPlayHistoryFeatureEnabled } from '../playHistoryFlag'
import { createSession, closeSession, finishTogether, finishSessionHandshake, isCurrentSession, onSessionClose, getSocketSession, getSession } from './session'
import { createInitialModuleReadys, setSyncModuleReady } from './moduleReadys'
import { addSyncReadyListener, notifySyncReady, removeSyncReadyListener } from './syncReady'

export { notifySyncReady } from './syncReady'

let status: LX.Sync.Status = {
  status: false,
  message: '',
}

export const sendSyncStatus = (newStatus: Omit<LX.Sync.Status, 'address'>) => {
  status = { ...newStatus, lastSyncedAt: newStatus.status ? Date.now() : status.lastSyncedAt }
  setSyncStatus(status)
}

export const sendSyncMessage = (message: string) => {
  status.message = message
  setSyncStatus(status)
}

const heartbeatTools = {
  failedNum: 0,
  maxTryNum: 100000,
  connectTimeout: null as NodeJS.Timeout | null,
  pingTimeout: null as NodeJS.Timeout | null,
  delayRetryTimeout: null as NodeJS.Timeout | null,
  handleOpen(socket: LX.Sync.Socket, sessionId: number) {
    console.log('open')
    // this.failedNum = 0
    this.heartbeat(socket, sessionId)
  },
  heartbeat(socket: LX.Sync.Socket, sessionId: number) {
    if (this.pingTimeout) clearTimeout(this.pingTimeout)

    // Use `WebSocket#terminate()`, which immediately destroys the connection,
    // instead of `WebSocket#close()`, which waits for the close timer.
    // Delay should be equal to the interval at which your server
    // sends out pings plus a conservative assumption of the latency.
    this.pingTimeout = setTimeout(() => {
      if (isCurrentSession(sessionId)) socket.close()
    }, 30000 + 1000)
  },
  reConnnect(socket: LX.Sync.Socket, sessionId: number) {
    this.clearTimeout()
    // client = null
    if (!client) return

    if (++this.failedNum > this.maxTryNum) {
      this.failedNum = 0
      sendSyncStatus({
        status: false,
        message: 'Connect error',
      })
      throw new Error('connect error')
    }

    const waitTime = retryDelayMs(this.failedNum)
    sendSyncStatus({ status: false, message: status.message || 'disconnected', closeCode: status.closeCode, attempts: this.failedNum, retryAt: Date.now() + waitTime })

    // sendSyncStatus({
    //   status: false,
    //   message: `Waiting ${waitTime / 1000}s reconnect...`,
    // })

    this.delayRetryTimeout = setTimeout(() => {
      if (client !== socket || getSession()?.id != sessionId) return
      this.delayRetryTimeout = null
      console.log(dateFormat(new Date()), 'reconnect...')
      sendSyncStatus({
        status: false,
        message: `Try reconnect... (${this.failedNum})`,
        attempts: this.failedNum,
      })
      connect(socket.data.urlInfo, socket.data.keyInfo)
    }, waitTime)
  },
  clearTimeout() {
    if (this.connectTimeout) {
      clearTimeout(this.connectTimeout)
      this.connectTimeout = null
    }
    if (this.delayRetryTimeout) {
      clearTimeout(this.delayRetryTimeout)
      this.delayRetryTimeout = null
    }
    if (this.pingTimeout) {
      clearTimeout(this.pingTimeout)
      this.pingTimeout = null
    }
  },
  connect(socket: LX.Sync.Socket, sessionId: number) {
    console.log('heartbeatTools connect')
    this.connectTimeout = setTimeout(() => {
      if (!isCurrentSession(sessionId)) return
      this.connectTimeout = null
      if (client) {
        try {
          client.close(SYNC_CLOSE_CODE.failed)
        } catch {}
      }
      if (++this.failedNum > this.maxTryNum) {
        this.failedNum = 0
        sendSyncStatus({
          status: false,
          message: 'Connect error',
        })
        throw new Error('connect error')
      }
      sendSyncStatus({
        status: false,
        message: 'Connect timeout, try reconnect...',
      })
      this.reConnnect(socket, sessionId)
    }, 2 * 60 * 1000)
    socket.addEventListener('open', () => {
      if (!isCurrentSession(sessionId)) return
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout)
        this.connectTimeout = null
      }
      this.handleOpen(socket, sessionId)
    })
    socket.addEventListener('message', ({ data }) => {
      if (!isCurrentSession(sessionId)) return
      if (data == 'ping') this.heartbeat(socket, sessionId)
    })
    socket.addEventListener('close', (event) => {
      if (!isCurrentSession(sessionId)) return
      // console.log(event.code)
      sendSyncStatus({ ...status, status: false, closeCode: event.code, attempts: this.failedNum })
      switch (event.code) {
        case SYNC_CLOSE_CODE.normal:
        case SYNC_CLOSE_CODE.failed:
          return
      }
      this.reConnnect(socket, sessionId)
    })
  },
}


let client: LX.Sync.Socket | null

export const onSyncSocketReady = (listener: () => void): (() => void) => {
  addSyncReadyListener(listener)
  if (client?.isReady) listener()
  return () => { removeSyncReadyListener(listener) }
}

export const getReadySyncSocket = (): LX.Sync.Socket | null => {
  return client?.isReady ? client : null
}
// let listSyncPromise: Promise<void>
export const connect = (urlInfo: LX.Sync.UrlInfo, keyInfo: LX.Sync.KeyInfo) => {
  heartbeatTools.clearTimeout()
  const session = new WebSocket(`${urlInfo.wsProtocol}//${urlInfo.hostPath}/socket?i=${encodeURIComponent(keyInfo.clientId)}&t=${encodeURIComponent(aesEncrypt(SYNC_CODE.msgConnect, keyInfo.key))}`) as LX.Sync.Socket
  const previousSocket = client
  const connection = createSession(session)
  previousSocket?.close(SYNC_CLOSE_CODE.normal)
  const sessionId = connection.id
  client = session
  session.data = {
    keyInfo,
    urlInfo,
  }
  session.isReady = false
  session.moduleReadys = createInitialModuleReadys()
  heartbeatTools.connect(session, sessionId)

  let closeEvents: Array<(err: Error) => (void | Promise<void>)> = []
  let disconnected = true

  const message2read = createMsg2call<LX.Sync.ServerSyncActions>({
    funcsObj: {
      ...Object.fromEntries(Object.entries(callObj).map(([name, handler]) => [name, (...args: unknown[]) => {
        if (!isCurrentSession(sessionId)) return
        return (handler as (...params: unknown[]) => unknown)(...args)
      }])) as typeof callObj,
      async together_sync_finished() {
        if (!isCurrentSession(sessionId)) return
        finishTogether(sessionId)
        if (session.isReady) setTimeout(() => { if (isCurrentSession(sessionId)) notifySyncReady() }, 0)
      },
      finished() {
        if (!isCurrentSession(sessionId)) return
        session.isReady = true
        finishSessionHandshake(sessionId)
        if (isPlayHistoryFeatureEnabled()) setSyncModuleReady(session, 'playHistory', true)
        sendSyncStatus({
          status: true,
          message: '',
        })
        heartbeatTools.failedNum = 0
        // Return first so the server finishes the handshake, then pull and push.
        setTimeout(() => { if (isCurrentSession(sessionId)) notifySyncReady() }, 0)
      },
    },
    timeout: 120 * 1000,
    sendMessage(data) {
      if (disconnected || !isCurrentSession(sessionId)) throw new Error('disconnected')
      void encryptMsg(keyInfo, JSON.stringify(data)).then((data) => {
        if (isCurrentSession(sessionId)) session.send(data)
      }).catch((err) => {
        if (!isCurrentSession(sessionId)) return
        log.error('encrypt msg error: ', err)
        session.close(SYNC_CLOSE_CODE.failed)
      })
    },
    onCallBeforeParams(rawArgs) {
      const args = Array.isArray(rawArgs) ? rawArgs : []
      return [session, ...args]
    },
    onError(error, path, groupName) {
      const name = groupName ?? ''
      log.r_error(`sync call ${name} ${path.join('.')} error:`, error)
      // if (groupName == null) return
      // client?.close(SYNC_CLOSE_CODE.failed)
      // sendSyncStatus({
      //   status: false,
      //   message: error.message,
      // })
    },
  })

  session.remote = message2read.remote
  session.remoteQueueList = message2read.createQueueRemote('list')
  session.remoteQueueDislike = message2read.createQueueRemote('dislike')

  session.addEventListener('message', ({ data }) => {
    if (!isCurrentSession(sessionId)) return
    if (data == 'ping') return
    if (typeof data === 'string') {
      void decryptMsg(keyInfo, data).then((data) => {
        if (!isCurrentSession(sessionId)) return
        let syncData: LX.Sync.ServerSyncActions
        try {
          syncData = JSON.parse(data)
        } catch (err) {
          log.error('parse msg error: ', err)
          session.close(SYNC_CLOSE_CODE.failed)
          return
        }
        message2read.message(syncData)
      }).catch((error) => {
        if (!isCurrentSession(sessionId)) return
        log.error('decrypt msg error: ', error)
        session.close(SYNC_CLOSE_CODE.failed)
      })
    }
  })
  session.onClose = function(handler: typeof closeEvents[number]) {
    closeEvents.push(handler)
    return () => {
      const index = closeEvents.indexOf(handler)
      if (index >= 0) closeEvents.splice(index, 1)
    }
  }

  const initMessage = 'Wait syncing...'
  session.addEventListener('open', () => {
    if (!isCurrentSession(sessionId)) return
    log.info('connect')
    session.isReady = false
    setPlayHistoryFeatureEnabled(false)
    session.moduleReadys = createInitialModuleReadys()
    disconnected = false
    sendSyncStatus({
      status: false,
      message: initMessage,
      attempts: heartbeatTools.failedNum,
    })
  })
  onSessionClose(sessionId, () => {
    session.isReady = false
    setPlayHistoryFeatureEnabled(false)
    disconnected = true
    const err = new Error('closed')
    for (const handler of closeEvents) {
      try { void Promise.resolve(handler(err)).catch(error => { log.error(error) }) } catch (error) { log.error(error) }
    }
    closeEvents = []
    message2read.destroy()
  })
  session.addEventListener('close', ({ code }) => {
    if (!isCurrentSession(sessionId)) return
    closeSession(sessionId)
    switch (code) {
      case SYNC_CLOSE_CODE.normal:
      // case SYNC_CLOSE_CODE.failed:
        sendSyncStatus({
          status: false,
          message: '',
        })
        break
      case SYNC_CLOSE_CODE.failed:
        if (!status.message || status.message == initMessage) {
          sendSyncStatus({
            status: false,
            message: 'failed',
          })
        }
        break
    }
  })
  session.addEventListener('error', ({ message }) => {
    if (!isCurrentSession(sessionId)) return
    sendSyncStatus({
      ...status,
      status: false,
      message,
    })
  })
}

export const disconnect = async() => {
  if (!client) {
    sendSyncStatus({ status: false, message: '' })
    return
  }
  log.info('disconnecting...')
  const socket = client
  closeSession(getSocketSession(socket)!.id)
  socket.close(SYNC_CLOSE_CODE.normal)
  sendSyncStatus({ status: false, message: '' })
  client = null
  heartbeatTools.clearTimeout()
  heartbeatTools.failedNum = 0
}

export const reconnectNow = (): boolean => {
  if (!client) return false
  const { urlInfo, keyInfo } = client.data
  sendSyncStatus({ status: false, message: SYNC_CODE.connecting, attempts: heartbeatTools.failedNum })
  connect(urlInfo, keyInfo)
  return true
}

export const getStatus = (): LX.Sync.Status => status
