<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# UI Refactor Interfaces

本文记录本轮 UI 组件化后的主要接口、事件入口和维护约定。目标是让后续改歌单页、搜索页、添加到歌单弹窗时，不需要重新阅读整个 `PlaylistTab`。

## Page Level Interfaces

### `PlaylistTab`

位置：`src/screens/Home/Vertical/Tabs/PlaylistTab.tsx`

```ts
interface PlaylistTabProps {
  onSharedTopBarVisibleChange?: (visible: boolean) => void
}
```

职责：

- 渲染“我的歌单”主页及从该主页进入的本地歌单详情。
- 维护顶部共享搜索栏显隐状态。
- 不再作为独立 overlay 的详情承载组件。

### `PlaylistLibraryScene` / `PlaylistDetailScene` / `PlaylistSearchScene`

位置：`src/components/playlist`

```ts
interface PlaylistLibrarySceneProps { /* 歌单库展示数据、播放/排序/新建回调 */ }
interface PlaylistDetailSceneProps { /* 详情歌曲列表、导入面板、拖拽和管理弹窗回调 */ }
interface PlaylistSearchSceneProps { /* 搜索输入、建议词、结果列表和来源菜单状态 */ }
```

职责：

- `PlaylistLibraryScene` 只负责“我的歌单”主页渲染，包括快捷歌单、展示模式切换、排序入口和新建歌单入口。
- `PlaylistDetailScene` 只负责本地详情页渲染，包括详情列表、导入抽屉、拖拽浮层和管理弹窗。
- `PlaylistSearchScene` 只负责歌单页内搜索态渲染，并复用 `GlassSearchField` 与 `SearchMusicResultRow`。
- `PlaylistTab` 保持为状态和事件编排层，避免继续堆叠大型 JSX。

### `PlaylistDetailOverlay`

位置：`src/components/playlist/PlaylistDetailOverlay.tsx`

```ts
interface PlaylistDetailOverlayProps {
  detail: PlaylistDetailPayload
  onClose: () => void
}
```

职责：

- 承接 `global.app_event.openPlaylistDetail(payload)` 打开的详情层。
- 支持本地歌单详情、在线歌单详情、导入、转存、重命名、删除、播放和本地歌曲拖拽排序。
- 监听 `global.app_event.closePlaylistDetail()` 并播放关闭动画后调用 `onClose`。

## Component Interfaces

### Playlist Detail Components

位置：`src/components/playlist`

- `PlaylistDetailHeader`：详情页头部，接收封面、标题、统计信息、来源标签和管理动作。
- `PlaylistDetailSongItem`：详情歌曲行，接收歌曲、来源色、拖拽位移动画和播放/删除/长按回调。
- `PlaylistSongDragOverlay`：拖拽中的浮层卡片，接收歌曲、来源色、top/scale/opacity 动画值。
- `PlaylistImportPanel`：本地歌单导入面板，接收候选歌曲、选中 map、全选/提交/关闭回调。

### Add To Playlist Components

位置：`src/components/MusicAddModal/TargetPlaylistList.tsx`

```ts
interface TargetPlaylistListProps {
  musicInfo?: LX.Music.MusicInfo
  excludeListId?: string
  defaultNewListName?: string
  onCreated?: (listInfo: LX.List.UserListInfo) => void | Promise<void>
  onPress: (listInfo: LX.List.MyListInfo) => void
}
```

使用约定：

- `musicInfo` 存在时为单曲添加，会检查目标歌单是否已有该歌曲。
- `excludeListId` 用于多曲移动/添加时排除来源歌单。
- `MusicAddModalType.show(info)` 与 `MusicMultiAddModalType.show(info)` 对外接口保持不变。

### Search Components

位置：`src/components/search`

- `GlassSearchField`：统一玻璃搜索框外壳，保留原 blur/fallback 行为。
- `SearchMusicResultRow`：音乐搜索结果行，接收播放、收藏、添加回调。
- `SearchSonglistResultRow`：歌单搜索结果行，接收打开详情回调。
- `getSourceTone(source)`：统一来源标签颜色。

## Hook Interfaces

### `useLinkedPlaylistId`

位置：`src/components/playlist/hooks/useLinkedPlaylistId.ts`

```ts
const linkedPlaylistId: string | null = useLinkedPlaylistId()
```

职责：

- 判断当前播放内容是否来自某个真实歌单。
- 当播放队列是临时列表时，会对比临时列表与来源歌单内容，只有完全一致才返回来源歌单 id。
- 供首页、歌单页和后续详情组件判断播放按钮的当前态。

## Event Flow

### 打开歌单详情

```ts
global.app_event.openPlaylistDetail({
  type: 'local',
  listId: 'love',
})

global.app_event.openPlaylistDetail({
  type: 'onlineSonglist',
  id: '123',
  source: 'kw',
  name: '歌单名',
  img: null,
})
```

竖屏主容器 `Home/Vertical/Main.tsx` 监听该事件，并渲染 `PlaylistDetailOverlay`。

### 关闭歌单详情

```ts
global.app_event.closePlaylistDetail()
```

`PlaylistDetailOverlay` 会处理关闭动画，然后调用 `onClose` 让主容器卸载 overlay。

## Maintenance Rules

- 不要再为了打开独立详情层而复用整份 `PlaylistTab`。
- 新增歌单详情 UI 时优先放在 `src/components/playlist`，页面容器只负责接线和状态。
- 新增搜索行或搜索输入变体时优先复用 `src/components/search`。
- 添加到歌单弹窗的外部 imperative API 需要保持兼容，避免影响已有调用方。
- 性能优化优先通过组件边界、稳定 `renderItem`、稳定 key 和减少大组件状态更新来做，不新增全局缓存层。
