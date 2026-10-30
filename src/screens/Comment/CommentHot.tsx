import { getHotComment } from './utils'
import List from './components/List'
import useCommentLoad, { type CommentLoadProps } from './useCommentLoad'

export default (props: CommentLoadProps) => {
  const { listRef, handleListLoadMore, handleListRefresh } = useCommentLoad(props, getHotComment)
  return (
    <List
      ref={listRef}
      onLoadMore={handleListLoadMore}
      onRefresh={handleListRefresh}
    />
  )
}
