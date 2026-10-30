import { useEffect, useLayoutEffect, useRef } from 'react'
import music from '@/utils/musicSdk'
import { filterList, type CommentInfo } from './utils'
import { type ListType } from './components/List'

const limit = 15
type LoadKind = 'initial' | 'refresh' | 'silent' | 'more'
type FetchComments = (musicInfo: LX.Music.MusicInfoOnline, page: number, limit: number) => Promise<CommentInfo>

export interface CommentLoadProps {
  musicInfo: LX.Music.MusicInfoOnline
  onUpdateTotal: (total: number) => void
  refreshKey?: number
}

export default function useCommentLoad({ musicInfo, onUpdateTotal, refreshKey = 0 }: CommentLoadProps, fetchComments: FetchComments) {
  const listRef = useRef<ListType>(null)
  const latest = useRef({ musicInfo, onUpdateTotal })
  latest.current = { musicInfo, onUpdateTotal }
  const key = JSON.stringify([musicInfo.source, musicInfo.id])
  const state = useRef({ generation: 0, key: '', mounted: false, page: 1, maxPage: 1, isEnd: false, active: null as LoadKind | null })
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  const invalidate = () => {
    state.current.generation++
    for (const timer of timers.current) clearTimeout(timer)
    timers.current.clear()
    state.current.active = null
  }

  const load = (kind: LoadKind) => {
    const info = state.current
    if (!info.mounted || info.key !== key) return
    // Silent refresh keeps the current display and skips busy loaders. Pulls coalesce
    // while refreshing; an explicit refresh supersedes pagination/initial delays.
    if (kind === 'silent' && info.active) return
    if (kind === 'refresh' && (info.active === 'refresh' || info.active === 'silent')) return
    if (kind === 'more' && (info.active !== null || info.isEnd)) return
    const song = latest.current.musicInfo
    if (!song.id || !music[song.source].comment) return
    invalidate()
    const generation = info.generation
    const isCurrent = () => info.mounted && info.key === key && info.generation === generation
    const delay = (callback: () => void) => {
      const timer = setTimeout(() => {
        timers.current.delete(timer)
        if (isCurrent()) callback()
      }, 300)
      timers.current.add(timer)
    }
    const finish = () => {
      if (!isCurrent()) return
      info.active = null
      listRef.current?.setStatus(info.isEnd ? 'end' : 'idle')
    }
    const page = kind === 'more' && listRef.current?.getList().length ? info.page + 1 : 1
    info.active = kind
    if (kind === 'refresh') listRef.current?.setStatus('refreshing')
    else if (kind !== 'silent') listRef.current?.setStatus('loading')

    void (async() => {
      try {
        const { comments, maxPage, total } = await fetchComments(song, page, limit)
        if (!isCurrent()) return
        info.page = page
        if (kind !== 'more') {
          info.maxPage = maxPage
          latest.current.onUpdateTotal(total)
        }
        info.isEnd = kind === 'more' ? page >= info.maxPage : maxPage === 1
        const writeList = () => {
          if (!isCurrent()) return
          const previous = kind === 'more' ? listRef.current?.getList() ?? [] : []
          listRef.current?.setList(filterList([...previous, ...comments]))
        }
        if (kind === 'initial') {
          delay(() => {
            writeList()
            delay(finish)
          })
        } else {
          writeList()
          finish()
        }
      } catch (error) {
        if (!isCurrent()) return
        info.active = null
        if (error instanceof Error && error.message === '取消请求') finish()
        else listRef.current?.setStatus('error')
      }
    })()
  }

  useLayoutEffect(() => {
    invalidate()
    const info = state.current
    Object.assign(info, { key, mounted: true, page: 1, maxPage: 1, isEnd: false })
    listRef.current?.setList([])
    listRef.current?.setStatus('idle')
    load('initial')
    return () => {
      info.mounted = false
      invalidate()
    }
  // Only song identity/fetcher changes restart the loader, not metadata or totals.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fetchComments])

  useEffect(() => {
    if (refreshKey > 0) load('silent')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey])

  return {
    listRef,
    handleListLoadMore: () => { load('more') },
    handleListRefresh: () => { load('refresh') },
  }
}
