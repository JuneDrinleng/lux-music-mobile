/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useMemo, useState } from 'react'
import { FlatList, View } from 'react-native'

import { MdiIcon } from '@/components/common/MdiIcon'
import Text from '@/components/common/Text'
import { MagazineSheetRow } from '@/components/magazine'
import { LIST_IDS } from '@/config/constant'
import { useI18n } from '@/lang'
import { useMyList, useMusicExistsList } from '@/store/list/hook'
import { useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { toast } from '@/utils/tools'

import CreateUserList from './CreateUserList'

const listIconName = (listId: string) => {
  switch (listId) {
    case LIST_IDS.LOVE:
      return 'heart-outline'
    case LIST_IDS.DEFAULT:
      return 'play-circle-outline'
    default:
      return 'music-note-eighth'
  }
}

const IconBlock = ({
  name,
  dashed = false,
}: {
  name: string
  dashed?: boolean
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <View style={{
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: dashed ? 'transparent' : r.placeholder,
      borderWidth: dashed ? 1.5 : 0,
      borderColor: r.ink,
      borderStyle: dashed ? 'dashed' : 'solid',
    }}>
      <MdiIcon name={name} size={18} color={r.ink} />
    </View>
  )
}

const CreatePlaylistRow = ({
  defaultName,
  onCreated,
  last,
}: {
  defaultName?: string
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
  last?: boolean
}) => {
  const [isEdit, setEdit] = useState(false)
  const t = useI18n()

  if (isEdit) {
    return (
      <CreateUserList
        isEdit={isEdit}
        onHide={() => { setEdit(false) }}
        defaultName={defaultName}
        onCreated={onCreated}
      />
    )
  }

  return (
    <MagazineSheetRow
      coverSize={0}
      title={t('list_create')}
      last={last}
      onPress={() => { setEdit(true) }}
      leading={<IconBlock name="plus" dashed />}
    />
  )
}

const SingleTargetRow = ({
  listInfo,
  musicInfo,
  last,
  onPress,
}: {
  listInfo: LX.List.MyListInfo
  musicInfo: LX.Music.MusicInfo
  last: boolean
  onPress: (listInfo: LX.List.MyListInfo) => void
}) => {
  const isExists = useMusicExistsList(listInfo, musicInfo)
  const t = useI18n()
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)

  return (
    <MagazineSheetRow
      coverSize={0}
      title={listInfo.name}
      last={last}
      disabled={isExists}
      onPress={() => {
        if (isExists) {
          toast(t('list_add_tip_exists'))
          return
        }
        onPress(listInfo)
      }}
      leading={<IconBlock name={listIconName(listInfo.id)} />}
      trailing={
        isExists
          ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <MdiIcon name="check" size={18} color={r.faint} />
              <Text size={12} color={r.faint} style={{ fontWeight: '600' }}>{t('sheet_already_in_list')}</Text>
            </View>
            )
          : <MdiIcon name="plus-circle-outline" size={22} color={r.ink} />
      }
    />
  )
}

const MultiTargetRow = ({
  listInfo,
  last,
  onPress,
}: {
  listInfo: LX.List.MyListInfo
  last: boolean
  onPress: (listInfo: LX.List.MyListInfo) => void
}) => {
  const { colors } = useLuxTheme()
  const r = magazineRoles(colors)
  return (
    <MagazineSheetRow
      coverSize={0}
      title={listInfo.name}
      last={last}
      onPress={() => { onPress(listInfo) }}
      leading={<IconBlock name={listIconName(listInfo.id)} />}
      trailing={<MdiIcon name="plus-circle-outline" size={22} color={r.ink} />}
    />
  )
}

export interface TargetPlaylistListProps {
  musicInfo?: LX.Music.MusicInfo
  excludeListId?: string
  defaultNewListName?: string
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
  onPress: (listInfo: LX.List.MyListInfo) => void
  /** When true, omit create-list row (move mode). */
  allowCreate?: boolean
}

type RowItem =
  | { kind: 'create' }
  | { kind: 'list', list: LX.List.MyListInfo }

export default ({
  musicInfo,
  excludeListId,
  defaultNewListName,
  onCreated,
  onPress,
  allowCreate = true,
}: TargetPlaylistListProps) => {
  const allList = useMyList()
  const targetLists = useMemo(() => {
    if (!excludeListId) return allList
    return allList.filter(list => list.id != excludeListId)
  }, [allList, excludeListId])

  const rows = useMemo((): RowItem[] => {
    const next: RowItem[] = []
    if (allowCreate && onCreated) next.push({ kind: 'create' })
    for (const list of targetLists) next.push({ kind: 'list', list })
    return next
  }, [allowCreate, onCreated, targetLists])

  return (
    <FlatList
      data={rows}
      keyExtractor={(item, index) => item.kind === 'create' ? 'create' : item.list.id + String(index)}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingBottom: 8 }}
      renderItem={({ item, index }) => {
        const last = index >= rows.length - 1
        if (item.kind === 'create') {
          return (
            <CreatePlaylistRow
              defaultName={defaultNewListName}
              onCreated={onCreated}
              last={last}
            />
          )
        }
        return musicInfo
          ? (
            <SingleTargetRow
              listInfo={item.list}
              musicInfo={musicInfo}
              last={last}
              onPress={onPress}
            />
            )
          : (
            <MultiTargetRow
              listInfo={item.list}
              last={last}
              onPress={onPress}
            />
            )
      }}
    />
  )
}
