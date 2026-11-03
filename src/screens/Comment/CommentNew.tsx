import { getNewComment } from './utils'
import List from './components/List'
import useCommentLoad, { type CommentLoadProps } from './useCommentLoad'

export default (props: CommentLoadProps) => {
  const { listRef, handleListLoadMore, handleListRefresh } = useCommentLoad(props, getNewComment)
  return (
    <List
      ref={listRef}
      onLoadMore={handleListLoadMore}
      onRefresh={handleListRefresh}
    />
  )
}
