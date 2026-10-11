/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import searchState from '@/store/search/state'
import searchActions from '@/store/search/action'
import { getSearchHistory as getSearchHistoryFromStore, saveSearchHistory } from '@/utils/data'


export const setSearchType: typeof searchActions['setSearchType'] = (type) => {
  searchActions.setSearchType(type)
}
export const setSearchText: typeof searchActions['setSearchText'] = (text) => {
  searchActions.setSearchText(text)
}
export const setTipListInfo: typeof searchActions['setTipListInfo'] = (text, source) => {
  searchActions.setTipListInfo(text, source)
}
export const setTipList: typeof searchActions['setTipList'] = (list) => {
  searchActions.setTipList(list)
}

let historyLoaded = false
let historyLoadPromise: Promise<void> | undefined
let historyClearRevision = 0

const loadSearchHistory = async() => {
  if (historyLoaded) return
  historyLoadPromise ??= getSearchHistoryFromStore().then((list) => {
    // Clearing history while storage is loading must not restore the old words.
    if (historyLoaded) return
    searchActions.setHistoryWord(list)
    historyLoaded = true
  }).finally(() => {
    historyLoadPromise = undefined
  })
  await historyLoadPromise
}

export const getSearchHistory = async() => {
  await loadSearchHistory()
  // Store actions mutate the list; React consumers need an independent snapshot.
  return [...searchState.historyList]
}
export const addHistoryWord = async(word: string) => {
  word = word.trim()
  if (!word) return
  const clearRevision = historyClearRevision
  await loadSearchHistory()
  if (clearRevision !== historyClearRevision) return
  const list = searchActions.addHistoryWord(word)
  if (!list) return
  void saveSearchHistory(list)
}
export const removeHistoryWord = (index: number) => {
  const list = searchActions.removeHistoryWord(index)
  void saveSearchHistory(list)
}
export const clearHistoryList = () => {
  historyClearRevision += 1
  historyLoaded = true
  const list = searchActions.clearHistoryList()
  void saveSearchHistory(list)
}
