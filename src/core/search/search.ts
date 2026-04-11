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

export const getSearchHistory = async() => {
  if (!searchState.historyList.length) searchActions.setHistoryWord(await getSearchHistoryFromStore())
  return searchState.historyList
}
export const addHistoryWord = async(word: string) => {
  if (!word) return
  if (!searchState.historyList.length) searchActions.setHistoryWord(await getSearchHistoryFromStore())
  const list = searchActions.addHistoryWord(word)
  if (!list) return
  void saveSearchHistory(list)
}
export const removeHistoryWord = (index: number) => {
  const list = searchActions.removeHistoryWord(index)
  void saveSearchHistory(list)
}
export const clearHistoryList = () => {
  const list = searchActions.clearHistoryList()
  void saveSearchHistory(list)
}

