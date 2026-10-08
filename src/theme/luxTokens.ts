/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/**
 * 竖屏新美化页面的语义色。
 *
 * 默认主题 id 是 `lime`（黄绿）。每个色值都抄自当前界面字面量，包含对比度偏低的
 * `#767d89` 等，不要为了对比度或「看起来更统一」改它们。同一语义在代码里有多套
 * 色值时拆成多个令牌（强调黄绿、墨色、玻璃白、阴影都如此），不要合并。
 *
 * 另外 5 套主题的 id 已留出，色值留到后续步骤。这里没有可切换的主题表。
 * 这套令牌不读写上游 `createThemes` / `useTheme()`。
 */

export const LUX_THEME_IDS = [
  'lime',
  'mist_blue',
  'sakura',
  'lavender',
  'oat_milk',
  'ink_night',
] as const

export type LuxThemeId = typeof LUX_THEME_IDS[number]

export type LuxThemeMode = 'light' | 'dark'

export interface LuxSwatch {
  surface: string
  accent: string
  ink: string
}

export interface LuxHomeCard extends LuxSwatch {
  soft: string
}

export interface LuxHeroCard {
  surface: string
  accent: string
  ink: string
  textSoft: string
}

export interface LuxSourceTone {
  text: string
  background: string
}

export interface LuxColors {
  bg: {
    /** 首页、歌单、搜索、设置页面底 `#eef0fb` */
    app: string
    /** 主壳与播放详情页底 `#ffffff` */
    plain: string
  }
  surface: {
    card: string
    /** 设置 `accountMetaCard` `#f7f8fd` */
    muted: string
    /** 设置关于信息块 `#f8f9fd` */
    mutedAlt: string
    /** 头像井、资料胶囊弱底 `#eef1f7` */
    well: string
    /** 头像未加载内底 `#f3eef2` */
    avatar: string
    /** 封面占位 `#e8eaef` */
    placeholder: string
    /** 首页骨架 `#e2e6ef` */
    skeleton: string
    /** 搜索胶囊底 `#dce0e9` */
    search: string
    /** 取消按钮底 `#f1f4fb` */
    cancel: string
    /** 弹窗次按钮、队列禁用、拖动底 `#f3f4f6` */
    neutral: string
    /** 圆形返回外圈 `#f0f1f6` */
    backBubble: string
    /** 圆形返回内底 `#e8e9f0` */
    backInner: string
    /** 导入面板浅底 `#edf0f7` */
    importMuted: string
    /** 导入输入底 `#f8f9fc` */
    importField: string
    /** 导入选中底 `#f6f9ea` */
    importSelected: string
    /** 队列交替行 `#f1f5f9` */
    queueAlt: string
    /** 播放条空进度轨 `#e8e8ec` */
    playerTrack: string
    /** 音源菜单选中行 `#f4f4f7` */
    sourceActive: string
    /** 详情操作禁用底 `#f8fafc` */
    actionDisabled: string
    /** 歌单/搜索结果卡浅底 `#f2f5fb` */
    songlistCard: string
    /** 导入确定禁用 `#eef1f6` */
    confirmDisabled: string
    /** 设置空信息块 `#eef1f8` */
    emptyBlock: string
    /** 搜索空状态卡 `#fcfbfc` */
    searchEmpty: string
    /** 搜索分段轨道 `#dfe6f3` */
    segment: string
    /** 分段开关默认底 `#e3e9f4` */
    segmentAlt: string
    /** 黑胶缺封面时的暗底 `#1e2233` */
    heroFallback: string
    /** 玻璃播放键 `#1d2434` */
    playGlass: string
    /** 黑胶中心 `#111111` */
    vinyl: string
  }
  ink: {
    /** 页面大标题 `#16181f` */
    pageTitle: string
    /** 子页大标题 `#1a1c1e` */
    subpageTitle: string
    /** 列表主文、选中单选项 `#20242d` */
    list: string
    /** 播放条 / 搜索歌名 / 弹窗标题 `#111827` */
    strong: string
    /** 搜索框已输入、返回图标 `#232733` */
    input: string
    /** 设置行副标题 `#767d89`。对比度偏低，保持原值 */
    secondary: string
    /** 分组小标题 `#838995` */
    eyebrow: string
    /** 未选中单选项 `#5f6572` */
    option: string
    /** 歌手、时间、播放条歌手 `#6b7280` */
    meta: string
    /** 时间与弱图标 `#9ca3af` */
    faint: string
    /** 右箭头、占位符、禁用行 `#9aa1ae` */
    quiet: string
    /** 取消字 `#4b5563` */
    cancel: string
    /** 搜索放大镜与清除 `#666d7b` */
    searchIcon: string
    /** 搜索无文字时的清除 `#bcc2cf` */
    searchClearIdle: string
    /** 底栏当前项图标 `#2a311c` */
    navActive: string
    /** 底栏未选项图标 `#5f6574` */
    navIdle: string
    /** 设置行图标 `#000000` */
    icon: string
    /** 深色控件上的图标 `#ffffff` */
    onControl: string
    /** 搜索类型与编辑图标 `#1A1A1A` */
    nearBlack: string
    /** 歌词页返回与分享 `#0f172a` */
    lyricNav: string
    /** 首页日推与列表行标题 `#171a22` */
    rowTitle: string
    /** 歌单宫格名、快捷卡标题 `#1c1c1e` */
    cardTitle: string
    /** 空歌单「新建」 `#19171c` */
    emptyAction: string
    /** 导入确定可用时的字 `#17191f` */
    importConfirm: string
    /** 首页筛选选中字 `#31351b` */
    chipActive: string
    /** 首页筛选未选字 `#5d6271` */
    chipIdle: string
    /** 首页/歌单小播放图标 `#303340` */
    miniPlay: string
    /** 宫格/列表切换未选 `#72798a` */
    displayIdle: string
    /** 资料签名 `#6a707c` */
    profileMeta: string
    /** 设置搜索空状态 `#707789` */
    emptySearch: string
    /** 搜索历史图标 `#757b85` */
    historyIcon: string
    /** 歌单歌曲数 `#8e8e93` */
    songCount: string
    /** 搜索建议箭头 `#8a909c` */
    suggestArrow: string
    /** 搜索中提示 `#8a92a1` */
    searching: string
    /** 资料卡右箭头 `#8f96a2` */
    heroArrow: string
    /** 搜索序号、首页弱信息 `#8a8f9d` */
    index: string
    /** 日推副文 `#7d8190` */
    rowMeta: string
    /** 输入光标 `#6f7688` */
    selection: string
    /** 「清除全部」等橄榄色文字 `#58651b` */
    olive: string
    /** 资料胶囊字 `#383d2b` */
    pill: string
    /** 更新日志紧凑正文、与跳转控件同值但不同角色 `#374151` */
    compact: string
    /** 空心喜欢 `#737373` */
    heartIdle: string
    /** 黄绿按钮上的字 `#111827`。深色主题里也不要跟 `ink.strong` 合成一个 */
    onAccent: string
  }
  accent: {
    /** 圆点、主按钮 `#c8e600` */
    primary: string
    /** 底栏当前项 `#d7ef59` */
    nav: string
    /** 首页筛选选中、导入选中 `#d9ef62` */
    chip: string
    /** 图标圆底、资料胶囊 `#dbeb92` */
    soft: string
    /** 搜索分段拇指描边 `#ddf27a` */
    thumbBorder: string
    /** 底栏圆点阴影 `#b5cc49` */
    navShadow: string
    /** 搜索高亮 `#85b300` */
    highlight: string
    /** 筛选按压涟漪 */
    chipRipple: string
  }
  danger: string
  like: string
  control: {
    /** 主播放键填充 `#111827` */
    play: string
    /** 主播放键阴影，色值同填充，角色分开 */
    playShadow: string
    /** 上一首 / 下一首 `#374151` */
    skip: string
  }
  iconWrap: {
    orange: string
    green: string
    purple: string
    amber: string
    red: string
  }
  badge: {
    /** 在线状态点 `#58651b`，与 `ink.olive` 同值不同角色 */
    online: string
    male: string
    female: string
    unknown: string
  }
  searchField: {
    border: string
  }
  glass: {
    fill08: string
    fill14: string
    fill26: string
    fill28: string
    fill30: string
    fill44: string
    fill52: string
    fill62: string
    fill70: string
    fill72: string
    fill78: string
    fill88: string
    fill90: string
    fill92: string
    fill95: string
    line16: string
    line18: string
    line45: string
    /** 播放条玻璃边，244 */
    rim56: string
    /** 底栏 / 设置玻璃边，244 */
    rim58: string
    /** 歌单玻璃边，244 */
    rim72: string
    /** 设置另一处玻璃边，245，不要并进 `rim72` */
    rim72Warm: string
    stroke: string
    backBorder: string
  }
  shadow: {
    /** `#2d3242` */
    ink: string
    /** `#76809b` */
    card: string
    /** `#81889a` */
    dock: string
    /** 弹窗 `#111827` */
    dialog: string
    /** 抬起、黑胶 `#000000` */
    black: string
    /** 玻璃播放键 `#2f3748` */
    playGlass: string
    /** 搜索空卡 `#2b1f25` */
    searchCard: string
    /** 分段拇指 `#687189` */
    segment: string
    /** `#747b8f` */
    softCard: string
    /** `#7b8193` */
    menu: string
    /** 首页英雄卡 `#84789b` */
    hero: string
  }
  scrim: {
    /** 播放详情与队列遮罩底 `#000000`（透明度在动画上） */
    mask: string
    /** 设置弹窗 `rgba(34, 39, 51, 0.16)` */
    settings: string
    /** 通用对话框 `rgba(15,23,42,0.22)` */
    dialog: string
    /** 导入 `rgba(17, 24, 39, 0.32)` */
    import: string
    /** 菜单 `rgba(17, 24, 39, 0.35)` */
    menu: string
    /** `rgba(17,24,39,0.04)` */
    wash: string
    home: string
    homeStrong: string
    /** 封面英雄压暗 */
    heroPhoto: string
    lyricIdle: string
    lyricHairline: string
    lyricTrack: string
    vinylRing: string
    vinylInner: string
  }
  line: {
    /** 设置分割线 `#e1e6ef` */
    divider: string
    /** `#d1d5db` */
    soft: string
    /** `#ececf0` */
    hairline: string
    /** 历史胶囊、中性边 `#e5e7eb` */
    neutral: string
    /** 对话框边 `#eef0f3` */
    prompt: string
    /** 音源面板 `#d9d9de` */
    panel: string
    /** 弹窗输入边 `#f1f1f3` */
    modal: string
    /** 详情操作边 `#e3e8f3` */
    detail: string
    /** 详情禁用边 `#edf2f7` */
    detailDisabled: string
    /** 导入拖条 `#d5d8e0` */
    import: string
    /** 搜索空卡边 `#eadfe4` */
    searchEmpty: string
    /** 分段边 `#d4ddeb` */
    segment: string
    /** 分段开关边 `#d7deec` */
    segmentAlt: string
    /** 导入选中边 `#d7e08b` */
    importSelected: string
    /** 分段拇指内边 `#eef2f8` */
    thumb: string
    /** 黑胶沟槽、徽章描边 `#ffffff` */
    white: string
  }
  source: {
    tx: LuxSourceTone
    wy: LuxSourceTone
    kg: LuxSourceTone
    kw: LuxSourceTone
    mg: LuxSourceTone
    /** 搜索 / 歌单未知来源。底是 `#e5e7eb`，与队列未知来源不同 */
    unknown: LuxSourceTone
    /** 播放队列未知来源底是 `#f3f4f6` */
    queueUnknown: LuxSourceTone
    /** 播放条本地进度环 `#64748b` */
    localPlayer: string
    /** 播放详情 / 歌词本地歌手色 `#475569` */
    localDetail: string
  }
  queue: {
    /** 当前行 `#eff6ff`，与酷狗标签底同值但角色不同 */
    current: string
    /** 关闭按钮 `#fef2f2`，与网易标签底同值但角色不同 */
    close: string
  }
  decor: {
    tonearmPivot: string
    tonearmArm: string
    tonearmHead: string
  }
  /** 无封面时 `coverTheme.ts` 的固定兜底。随封面算出的颜色不是令牌 */
  coverFallback: {
    top: string
    middle: string
    glow: string
    bottom: string
    accent: string
  }
  /** 首页推荐卡，四套都保留，不收成两个封面色 */
  homeCards: LuxHomeCard[]
  /** 首页英雄卡 */
  homeHeroes: LuxHeroCard[]
  /** 歌单缺封面循环色 */
  playlistCovers: LuxSwatch[]
}

export interface LuxTheme {
  id: LuxThemeId
  name: string
  mode: LuxThemeMode
  colors: LuxColors
}

export const limeColors: LuxColors = {
  bg: {
    app: '#eef0fb',
    plain: '#ffffff',
  },
  surface: {
    card: '#ffffff',
    muted: '#f7f8fd',
    mutedAlt: '#f8f9fd',
    well: '#eef1f7',
    avatar: '#f3eef2',
    placeholder: '#e8eaef',
    skeleton: '#e2e6ef',
    search: '#dce0e9',
    cancel: '#f1f4fb',
    neutral: '#f3f4f6',
    backBubble: '#f0f1f6',
    backInner: '#e8e9f0',
    importMuted: '#edf0f7',
    importField: '#f8f9fc',
    importSelected: '#f6f9ea',
    queueAlt: '#f1f5f9',
    playerTrack: '#e8e8ec',
    sourceActive: '#f4f4f7',
    actionDisabled: '#f8fafc',
    songlistCard: '#f2f5fb',
    confirmDisabled: '#eef1f6',
    emptyBlock: '#eef1f8',
    searchEmpty: '#fcfbfc',
    segment: '#dfe6f3',
    segmentAlt: '#e3e9f4',
    heroFallback: '#1e2233',
    playGlass: '#1d2434',
    vinyl: '#111111',
  },
  ink: {
    pageTitle: '#16181f',
    subpageTitle: '#1a1c1e',
    list: '#20242d',
    strong: '#111827',
    input: '#232733',
    secondary: '#767d89',
    eyebrow: '#838995',
    option: '#5f6572',
    meta: '#6b7280',
    faint: '#9ca3af',
    quiet: '#9aa1ae',
    cancel: '#4b5563',
    searchIcon: '#666d7b',
    searchClearIdle: '#bcc2cf',
    navActive: '#2a311c',
    navIdle: '#5f6574',
    icon: '#000000',
    onControl: '#ffffff',
    nearBlack: '#1A1A1A',
    lyricNav: '#0f172a',
    rowTitle: '#171a22',
    cardTitle: '#1c1c1e',
    emptyAction: '#19171c',
    importConfirm: '#17191f',
    chipActive: '#31351b',
    chipIdle: '#5d6271',
    miniPlay: '#303340',
    displayIdle: '#72798a',
    profileMeta: '#6a707c',
    emptySearch: '#707789',
    historyIcon: '#757b85',
    songCount: '#8e8e93',
    suggestArrow: '#8a909c',
    searching: '#8a92a1',
    heroArrow: '#8f96a2',
    index: '#8a8f9d',
    rowMeta: '#7d8190',
    selection: '#6f7688',
    olive: '#58651b',
    pill: '#383d2b',
    compact: '#374151',
    heartIdle: '#737373',
    onAccent: '#111827',
  },
  accent: {
    primary: '#c8e600',
    nav: '#d7ef59',
    chip: '#d9ef62',
    soft: '#dbeb92',
    thumbBorder: '#ddf27a',
    navShadow: '#b5cc49',
    highlight: '#85b300',
    chipRipple: 'rgba(217,239,98,0.5)',
  },
  danger: '#ef4444',
  like: '#FA5252',
  control: {
    play: '#111827',
    playShadow: '#111827',
    skip: '#374151',
  },
  iconWrap: {
    orange: '#ffedd5',
    green: '#d1fae5',
    purple: '#ede9fe',
    amber: '#fef9c3',
    red: '#fee2e2',
  },
  badge: {
    online: '#58651b',
    male: '#bfdbfe',
    female: '#fce7f3',
    unknown: '#e2e8f0',
  },
  searchField: {
    border: '#cdd2de',
  },
  glass: {
    fill08: 'rgba(255,255,255,0.08)',
    fill14: 'rgba(255,255,255,0.14)',
    fill26: 'rgba(255,255,255,0.26)',
    fill28: 'rgba(255,255,255,0.28)',
    fill30: 'rgba(255,255,255,0.3)',
    fill44: 'rgba(255,255,255,0.44)',
    fill52: 'rgba(255,255,255,0.52)',
    fill62: 'rgba(255,255,255,0.62)',
    fill70: 'rgba(255,255,255,0.7)',
    fill72: 'rgba(255,255,255,0.72)',
    fill78: 'rgba(255,255,255,0.78)',
    fill88: 'rgba(255,255,255,0.88)',
    fill90: 'rgba(255,255,255,0.9)',
    fill92: 'rgba(255,255,255,0.92)',
    fill95: 'rgba(255,255,255,0.95)',
    line16: 'rgba(255,255,255,0.16)',
    line18: 'rgba(255,255,255,0.18)',
    line45: 'rgba(255,255,255,0.45)',
    rim56: 'rgba(244,247,252,0.56)',
    rim58: 'rgba(244,247,252,0.58)',
    rim72: 'rgba(244,247,252,0.72)',
    rim72Warm: 'rgba(245,247,252,0.72)',
    stroke: 'rgba(230,234,243,0.92)',
    backBorder: 'rgba(231,236,245,0.96)',
  },
  shadow: {
    ink: '#2d3242',
    card: '#76809b',
    dock: '#81889a',
    dialog: '#111827',
    black: '#000000',
    playGlass: '#2f3748',
    searchCard: '#2b1f25',
    segment: '#687189',
    softCard: '#747b8f',
    menu: '#7b8193',
    hero: '#84789b',
  },
  scrim: {
    mask: '#000000',
    settings: 'rgba(34, 39, 51, 0.16)',
    dialog: 'rgba(15,23,42,0.22)',
    import: 'rgba(17, 24, 39, 0.32)',
    menu: 'rgba(17, 24, 39, 0.35)',
    wash: 'rgba(17,24,39,0.04)',
    home: 'rgba(22,24,31,0.08)',
    homeStrong: 'rgba(22,24,31,0.28)',
    heroPhoto: 'rgba(0,0,0,0.45)',
    lyricIdle: 'rgba(15,23,42,0.35)',
    lyricHairline: 'rgba(15,23,42,0.04)',
    lyricTrack: 'rgba(15,23,42,0.1)',
    vinylRing: 'rgba(15,23,42,0.08)',
    vinylInner: 'rgba(15,23,42,0.55)',
  },
  line: {
    divider: '#e1e6ef',
    soft: '#d1d5db',
    hairline: '#ececf0',
    neutral: '#e5e7eb',
    prompt: '#eef0f3',
    panel: '#d9d9de',
    modal: '#f1f1f3',
    detail: '#e3e8f3',
    detailDisabled: '#edf2f7',
    import: '#d5d8e0',
    searchEmpty: '#eadfe4',
    segment: '#d4ddeb',
    segmentAlt: '#d7deec',
    importSelected: '#d7e08b',
    thumb: '#eef2f8',
    white: '#ffffff',
  },
  source: {
    tx: { text: '#31c27c', background: '#ecfdf3' },
    wy: { text: '#d81e06', background: '#fef2f2' },
    kg: { text: '#2f88ff', background: '#eff6ff' },
    kw: { text: '#f59e0b', background: '#fffbeb' },
    mg: { text: '#e11d8d', background: '#fdf2f8' },
    unknown: { text: '#111827', background: '#e5e7eb' },
    queueUnknown: { text: '#111827', background: '#f3f4f6' },
    localPlayer: '#64748b',
    localDetail: '#475569',
  },
  queue: {
    current: '#eff6ff',
    close: '#fef2f2',
  },
  decor: {
    tonearmPivot: '#a7afbe',
    tonearmArm: '#b8bfcc',
    tonearmHead: '#7f8898',
  },
  coverFallback: {
    top: '#f6e6de',
    middle: '#f8eee7',
    glow: '#fbf6f2',
    bottom: '#ffffff',
    accent: '#cf5f35',
  },
  homeCards: [
    { surface: '#f2d6e6', accent: '#cf4f8f', ink: '#4f2340', soft: '#f9edf4' },
    { surface: '#e7ecfa', accent: '#5f76d9', ink: '#26355f', soft: '#f2f5fd' },
    { surface: '#e8f0d7', accent: '#8caf33', ink: '#435817', soft: '#f5f8ea' },
    { surface: '#f4e6d8', accent: '#c68444', ink: '#5b3b1c', soft: '#faf2ea' },
  ],
  homeHeroes: [
    { surface: '#f3d7ed', accent: '#613060', ink: '#16181f', textSoft: '#61556d' },
    { surface: '#dff0ad', accent: '#435817', ink: '#1f2613', textSoft: '#526236' },
    { surface: '#f3e6d5', accent: '#6b4b2e', ink: '#22170e', textSoft: '#705640' },
  ],
  playlistCovers: [
    { surface: '#f6e2e7', accent: '#cf385b', ink: '#652233' },
    { surface: '#ebe4d7', accent: '#8a6745', ink: '#45301d' },
    { surface: '#e4e8f1', accent: '#556b96', ink: '#293548' },
    { surface: '#ece6f2', accent: '#7f5da5', ink: '#413052' },
  ],
}

export const limeTheme: LuxTheme = {
  id: 'lime',
  name: '黄绿',
  mode: 'light',
  colors: limeColors,
}

/** 第 1 步只登记黄绿。没有其它主题对象，调用方无法切走默认值。 */
export const luxThemeRegistry: Record<'lime', LuxTheme> = {
  lime: limeTheme,
}

export const DEFAULT_LUX_THEME_ID: LuxThemeId = 'lime'

export const listLuxColorValues = (colors: LuxColors = limeColors): string[] => {
  const values: string[] = []
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      values.push(value)
      return
    }
    if (Array.isArray(value)) {
      value.forEach(visit)
      return
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(visit)
    }
  }
  visit(colors)
  return values
}
