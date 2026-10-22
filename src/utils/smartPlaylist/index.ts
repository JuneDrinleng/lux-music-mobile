/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { createList, getListMusics, overwriteListMusics, updateUserList } from '@/core/list'
import listState from '@/store/list/state'
import { LIST_IDS } from '@/config/constant'
import { getActiveSpace, onDataSpaceChanged } from '@/utils/dataSpace'
import { getPlayRecords, subscribePlayHistory } from '@/utils/playHistory/store'
import { buildSongFactsAsync, evaluateRulesAsync, type LibraryList } from './evaluator'
import { type RuleSet, type SmartPlaylistDefinition } from './model'
import { loadSmartPlaylistRules, removeSmartPlaylistRule, saveSmartPlaylistRule } from './store'
import { createSmartRefresh, materializeSongs } from './service'

let generation = 0
const writing = new Set<string>()
const guard = () => {
  const space = getActiveSpace()
  const token = generation
  return () => { if (space != getActiveSpace() || token != generation) throw Error('Smart playlist request cancelled') }
}
export const previewSmartPlaylist = async(ruleSet: RuleSet, check = guard()) => {
  const definitions = await loadSmartPlaylistRules()
  check()
  const derived = new Set(definitions.map(item => item.playlistId))
  const lists: Array<LibraryList<LX.Music.MusicInfo>> = []
  for (const info of [...listState.allList]) {
    if (derived.has(info.id)) continue
    const songs = await getListMusics(info.id)
    check()
    lists.push({ songs, liked: info.id == LIST_IDS.LOVE })
    await new Promise<void>(resolve => { setTimeout(resolve, 0) })
  }
  // Reject oversized work rather than silently produce a partial playlist.
  if (lists.reduce((sum, list) => sum + list.songs.length, 0) > 100000 || getPlayRecords().length > 200000) throw Error('Smart playlist library exceeds work limit')
  const facts = await buildSongFactsAsync(lists, getPlayRecords(), check)
  return evaluateRulesAsync(facts, ruleSet, Date.now(), check)
}
const writeResult = async(id: string, songs: LX.Music.MusicInfo[], check: () => void) => {
  const current = await getListMusics(id)
  check()
  writing.add(id)
  try { await materializeSongs(current, songs, async(next) => { check(); await overwriteListMusics(id, next) }) } finally { writing.delete(id) }
}
export const saveSmartPlaylist = async(definition: SmartPlaylistDefinition) => {
  generation++
  let check = guard()
  const result = await previewSmartPlaylist(definition.ruleSet, check)
  check()
  writing.add(definition.playlistId)
  try {
    const existing = listState.userList.find(list => list.id == definition.playlistId)
    if (!existing) await createList({ id: definition.playlistId, name: definition.name, list: [] })
    else if (existing.name != definition.name) await updateUserList([{ ...existing, name: definition.name }])
    check()
    await saveSmartPlaylistRule(definition)
    check()
    generation++
    check = guard()
    await writeResult(definition.playlistId, result.songs, check)
  } finally { writing.delete(definition.playlistId) }
}
export const refreshSmartPlaylists = async(onlyId?: string) => {
  const check = guard()
  const definitions = await loadSmartPlaylistRules()
  check()
  for (const definition of definitions) {
    if (!listState.userList.some(list => list.id == definition.playlistId)) {
      await removeSmartPlaylistRule(definition.playlistId)
      check()
      continue
    }
    if (!definition.autoRefresh || (onlyId && onlyId != definition.playlistId)) continue
    const result = await previewSmartPlaylist(definition.ruleSet, check)
    check()
    await writeResult(definition.playlistId, result.songs, check)
  }
}
export const startSmartPlaylists = () => {
  const refresh = createSmartRefresh(async() => refreshSmartPlaylists())
  const musicChanged = (ids: string[]) => { if (ids.some(id => !writing.has(id))) { generation++; refresh.trigger() } }
  const listsChanged = () => { if (!writing.size) { generation++; refresh.trigger() } }
  const historyChanged = () => { generation++; refresh.trigger() }
  const offHistory = subscribePlayHistory(historyChanged)
  const offSpace = onDataSpaceChanged(() => { generation++; refresh.trigger() })
  global.app_event.on('myListMusicUpdate', musicChanged)
  global.state_event.on('mylistUpdated', listsChanged)
  refresh.trigger()
  return () => {
    generation++
    refresh.stop()
    offHistory()
    offSpace()
    global.app_event.off('myListMusicUpdate', musicChanged)
    global.state_event.off('mylistUpdated', listsChanged)
  }
}
