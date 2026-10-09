/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

// Lux Proprietary

import AsyncStorage from '@react-native-async-storage/async-storage'

import {
  type PlaylistCoverEntry,
  type PlaylistCoverMapData,
  parsePlaylistCoverMap,
  playlistCoverKey,
  prunePlaylistCoverMap,
  rememberPlaylistCover,
  serializePlaylistCoverMap,
} from '@/utils/playlistCoverMap'

const STORAGE_KEY = 'lx_playlist_cover_urls'

let data: PlaylistCoverMapData = {}
let loaded = false
let loading: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

const keyListeners = new Map<string, Set<() => void>>()
const storeListeners = new Set<() => void>()

const emitKey = (key: string) => {
  const listeners = keyListeners.get(key)
  if (!listeners) return
  for (const listener of listeners) listener()
}

const emitStore = () => {
  for (const listener of storeListeners) listener()
}

const scheduleSave = () => {
  if (saveTimer) return
  saveTimer = setTimeout(() => {
    saveTimer = null
    void AsyncStorage.setItem(STORAGE_KEY, serializePlaylistCoverMap(data)).catch(() => {})
  }, 400)
}

export const loadPlaylistCoverStore = async() => {
  if (loaded) return
  if (!loading) {
    loading = (async() => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY)
        data = parsePlaylistCoverMap(raw)
      } catch {
        data = {}
      }
      loaded = true
      emitStore()
    })().finally(() => {
      loading = null
    })
  }
  await loading
}

export const peekPlaylistCover = (source: string, id: string): PlaylistCoverEntry | null => {
  return data[playlistCoverKey(source, id)] ?? null
}

export const listPlaylistCoverEntries = (): PlaylistCoverEntry[] => Object.values(data)

export const writePlaylistCover = (
  source: string,
  id: string,
  url: string,
  now = Date.now(),
  rejectUrls?: ReadonlySet<string>,
) => {
  const next = rememberPlaylistCover(data, { source, id, url, now, rejectUrls })
  if (next == data) return false
  data = next
  scheduleSave()
  emitKey(playlistCoverKey(source, id))
  return true
}

export const prunePlaylistCoverStore = (liveKeys: ReadonlySet<string>): PlaylistCoverEntry[] => {
  const result = prunePlaylistCoverMap(data, liveKeys)
  if (!result.removed.length) return []
  data = result.map
  scheduleSave()
  for (const entry of result.removed) emitKey(playlistCoverKey(entry.source, entry.id))
  return result.removed
}

export const notifyPlaylistCover = (source: string, id: string) => {
  emitKey(playlistCoverKey(source, id))
}

export const subscribePlaylistCover = (key: string, listener: () => void) => {
  let listeners = keyListeners.get(key)
  if (!listeners) {
    listeners = new Set()
    keyListeners.set(key, listeners)
  }
  listeners.add(listener)
  return () => {
    const current = keyListeners.get(key)
    if (!current) return
    current.delete(listener)
    if (!current.size) keyListeners.delete(key)
  }
}

export const subscribePlaylistCoverStore = (listener: () => void) => {
  storeListeners.add(listener)
  return () => {
    storeListeners.delete(listener)
  }
}
