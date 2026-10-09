/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useState, useMemo, useCallback } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { MdiIcon } from '@/components/common/MdiIcon'
import { createStyle } from '@/utils/tools'
import { formatPlayCount } from '@/utils'
import { type Comment } from '../utils'
import Text from '@/components/common/Text'
import { useLayout } from '@/utils/hooks'
import { useI18n } from '@/lang'
import Image from '@/components/common/Image'
import CommentImage from './CommentImage'
import CommentText from './CommentText'
import yuanbaoAvatar from '../../../../assets/img/yuanbao.png'
import emptyFavicon from '../../../../assets/img/empty-favicon.png'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { Hairline } from '@/components/magazine'
import { PLAYER_ICON_TAP } from '@/screens/PlayDetail/Vertical/PlayerChrome'

const CommentFloor = memo(({ comment, isLast, isReply }: {
  comment: Comment
  isLast?: boolean
  isReply?: boolean
}) => {
  const styles = useLuxStyles()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  const [isAvatarError, setIsAvatarError] = useState(false)
  const [showAllReplies, setShowAllReplies] = useState(false)
  const replyCount = comment.reply?.length ?? 0
  const hasMoreReplies = replyCount > 1
  const { onLayout, width } = useLayout()
  const t = useI18n()

  const handleAvatarError = useCallback(() => {
    setIsAvatarError(true)
  }, [])

  const replyComments = useMemo(() => {
    if (!comment.reply?.length) return null
    const visibleReplies = showAllReplies ? comment.reply : comment.reply.slice(0, 1)
    const endIndex = visibleReplies.length - 1
    return (
      <View style={[styles.replyFloor, { borderLeftColor: r.hairline }]}>
        {
          visibleReplies.map((c, index) => (
            <CommentFloor comment={c} isReply isLast={index === endIndex && !hasMoreReplies} key={`${comment.id}_${c.id}`} />
          ))
        }
        {hasMoreReplies
          ? (
            <TouchableOpacity style={styles.expandBtn} onPress={() => { setShowAllReplies(!showAllReplies) }}>
              <Text size={13} color={r.ink} style={styles.expandText}>
                {t(showAllReplies ? 'comment_collapse_replies' : 'comment_show_all_replies')}
              </Text>
            </TouchableOpacity>
            )
          : null}
      </View>
    )
  }, [comment.reply, comment.id, showAllReplies, hasMoreReplies, r.hairline, r.ink, styles, t])

  const likeLabel = comment.likedCount != null ? formatPlayCount(comment.likedCount) : null

  return (
    <View style={styles.container}>
      <View style={styles.comment}>
        <View style={[styles.avatarWrap, isReply ? styles.avatarSmall : null, { backgroundColor: r.placeholder }]}>
          <Image
            url={comment.userName === '元宝' ? yuanbaoAvatar : (comment.avatar && !isAvatarError ? comment.avatar : emptyFavicon)}
            onError={handleAvatarError}
            style={isReply ? styles.avatarImgSmall : styles.avatarImg}
          />
        </View>
        <View style={styles.right}>
          <View style={styles.info}>
            <View style={styles.userBlock}>
              <Text selectable numberOfLines={1} size={13} color={r.ink} style={styles.userName}>
                {comment.userName}
              </Text>
              <View style={styles.metaInfo}>
                <Text numberOfLines={1} size={11} color={r.faint}>{comment.timeStr}</Text>
                {comment.location
                  ? <Text numberOfLines={1} style={styles.location} size={11} color={r.faint}>
                      {t('location', { location: comment.location })}
                    </Text>
                  : null}
              </View>
            </View>
            {likeLabel != null
              ? (
                <View style={styles.like}>
                  <MdiIcon name="thumb-up-outline" size={14} color={r.faint} />
                  <Text size={12} color={r.faint} style={styles.likedCount}>{likeLabel}</Text>
                </View>
                )
              : null}
          </View>
          <CommentText text={comment.text} />
          {
            comment.images?.length
              ? (
                  <View style={styles.images} onLayout={onLayout}>
                    {
                      comment.images.map((url, index) => <CommentImage key={String(index)} url={url} maxWidth={width} />)
                    }
                  </View>
                )
              : null
          }
        </View>
      </View>
      {replyComments}
      {!isLast && !isReply ? <Hairline style={styles.rowRule} /> : null}
    </View>
  )
})

export default CommentFloor

const useLuxStyles = sharedLuxStyles(() => createStyle({
  container: {
    paddingTop: 14,
  },
  comment: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
    marginRight: 10,
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarImgSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  right: {
    flex: 1,
    minWidth: 0,
  },
  info: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  userBlock: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  userName: {
    fontWeight: '800',
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 6,
  },
  location: {
    flexShrink: 1,
  },
  like: {
    minWidth: PLAYER_ICON_TAP,
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  likedCount: {
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  images: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  replyFloor: {
    marginTop: 10,
    marginLeft: 42,
    paddingLeft: 12,
    borderLeftWidth: 2,
  },
  expandBtn: {
    minHeight: PLAYER_ICON_TAP,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  expandText: {
    fontWeight: '700',
  },
  rowRule: {
    marginTop: 14,
  },
}))
