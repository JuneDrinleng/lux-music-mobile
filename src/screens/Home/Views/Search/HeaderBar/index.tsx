/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { useMemo, useRef, forwardRef, useImperativeHandle, useState } from 'react'
import { TextInput, View } from 'react-native'

import DorpDownMenu, { type DorpDownMenuProps as _DorpDownMenuProps } from '@/components/common/DorpDownMenu'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { Icon } from '@/components/common/Icon'
import { type Source as MusicSource } from '@/store/search/music/state'
import { type Source as SonglistSource } from '@/store/search/songlist/state'
import { type SearchInputProps } from './SearchInput'

type Sources = Readonly<Array<MusicSource | SonglistSource>>

interface SourceMenu {
  action: Sources[number]
  label: string
}

export interface HeaderBarProps {
  onSourceChange: (source: Sources[number]) => void
  onTipSearch: SearchInputProps['onChangeText']
  onSearch: SearchInputProps['onSubmit']
  onHideTipList: SearchInputProps['onBlur']
  onShowTipList: SearchInputProps['onTouchStart']
}

export interface HeaderBarType {
  setSourceList: (list: Sources, activeSource: Sources[number]) => void
  setText: (text: string) => void
  blur: () => void
}

const getSourceLabel = (source: Sources[number]) => {
  return source === 'all' ? 'all' : source
}

export default forwardRef<HeaderBarType, HeaderBarProps>(({ onSourceChange, onTipSearch, onSearch, onHideTipList, onShowTipList }, ref) => {
  const inputRef = useRef<TextInput>(null)
  const theme = useTheme()
  const [text, setText] = useState('')
  const [sourceList, setSourceList] = useState<Sources>([])
  const [source, setSource] = useState<Sources[number]>('kw')

  useImperativeHandle(ref, () => ({
    setSourceList(list, activeSource) {
      setSourceList(list)
      setSource(activeSource)
    },
    setText(value) {
      setText(value)
    },
    blur() {
      inputRef.current?.blur()
    },
  }), [])

  const menus = useMemo<SourceMenu[]>(() => {
    return [...sourceList].sort((a, b) => getSourceLabel(a).localeCompare(getSourceLabel(b))).map((item) => ({
      action: item,
      label: getSourceLabel(item),
    }))
  }, [sourceList])

  type DorpDownMenuProps = _DorpDownMenuProps<typeof menus>

  const handleSelectSource: DorpDownMenuProps['onPress'] = ({ action }) => {
    setSource(action)
    onSourceChange(action)
  }

  return (
    <View style={{ ...styles.searchBar, backgroundColor: theme['c-app-background'] }}>
      <View style={[styles.searchInputWrap, { backgroundColor: theme['c-main-background'], borderColor: theme['c-border-background'] }]}>
        <Icon name="search-2" size={16} color={theme['c-500']} />
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={(value) => { setText(value); onTipSearch(value) }}
          onSubmitEditing={({ nativeEvent }) => {
            onSearch(nativeEvent.text)
          }}
          onBlur={onHideTipList}
          onTouchStart={onShowTipList}
          placeholder="Search songs, artists, albums..."
          placeholderTextColor={theme['c-500']}
          selectionColor={theme['c-primary']}
          style={[styles.input, { color: theme['c-font'] }]}
        />

        <DorpDownMenu
          menus={menus}
          onPress={handleSelectSource}
          activeId={source}
          center
          btnStyle={styles.sourceMenuBtn}
          btnRipple={false}
        >
          <View style={styles.sourceCapsule}>
            <Text size={12} color="#111827" style={styles.sourceText}>{getSourceLabel(source)}</Text>
            <Icon name="chevron-right-2" rawSize={13} color="#6b7280" style={styles.sourceChevron} />
          </View>
        </DorpDownMenu>
      </View>
    </View>
  )
})

const styles = createStyle({
  searchBar: {
    zIndex: 2,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 12,
    paddingRight: 8,
    height: 44,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    paddingVertical: 0,
  },
  sourceMenuBtn: {
    marginLeft: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  sourceCapsule: {
    height: 28,
    minWidth: 62,
    borderRadius: 14,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceText: {
    fontWeight: '600',
  },
  sourceChevron: {
    marginLeft: 2,
    transform: [{ rotate: '90deg' }],
  },
})

