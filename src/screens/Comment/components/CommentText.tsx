/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { memo, useMemo, useState } from 'react'
import { TouchableOpacity, View } from 'react-native'
import { createStyle } from '@/utils/tools'
import Text from '@/components/common/Text'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { PLAYER_ICON_TAP } from '@/screens/PlayDetail/Vertical/PlayerChrome'

const TEXT_LIMIT = 160
const SUB_TEXT_LIMIT = TEXT_LIMIT * 1.2

export default memo(({ text }: { text: string }) => {
  const [show, setShow] = useState(false)
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)

  const length = useMemo(() => {
    let count = 0
    let bCount = 0
    let subLength = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charAt(i)
      if (char == '\n') {
        count += bCount * 24 + 20
        bCount++
      } else {
        count++
        if (char.trim() != '') bCount &&= 0
      }
      if (!subLength && count > TEXT_LIMIT) subLength = i
      if (count >= SUB_TEXT_LIMIT) return subLength
    }
    return 0
  }, [text])

  return (
    length ? (
      <View>
        {
          show
            ? <Text selectable size={15} color={r.list} style={styles.text}>{text}</Text>
            : (
              <Text selectable size={15} color={r.list} style={styles.text}>
                {text.substring(0, length)}{' '}
                <Text size={15} color={r.faint}>……</Text>
              </Text>
              )
        }
        <TouchableOpacity style={styles.toggle} onPress={() => { setShow(!show) }}>
          <Text size={13} color={r.ink} style={styles.toggleText}>
            {show ? global.i18n.t('comment_hide_text') : global.i18n.t('comment_show_text')}
          </Text>
        </TouchableOpacity>
      </View>
    ) : <Text selectable size={15} color={r.list} style={styles.text}>{text}</Text>
  )
})

const styles = createStyle({
  text: {
    marginTop: 2,
    lineHeight: 23,
  },
  toggle: {
    marginTop: 10,
    minHeight: PLAYER_ICON_TAP,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  toggleText: {
    fontWeight: '700',
  },
})
