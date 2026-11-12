/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const warning = '这是 June 定稿的 v0.5.3 规则，改动前先问 June'
const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const has = (source, pattern, detail) => assert.match(source, pattern, `${detail}：${warning}`)
const lacks = (source, pattern, detail) => assert.doesNotMatch(source, pattern, `${detail}：${warning}`)
const extract = (source, pattern, detail) => {
  const match = source.match(pattern)
  assert.ok(match, `${detail}：${warning}`)
  return match[1]
}
const compact = source => source.replace(/\s+/g, '')
const style = (source, name) => extract(source, new RegExp(`\\b${name}: \\{([^}]+)\\}`), name)
const vertical = path => read(`src/screens/PlayDetail/Vertical/${path}`)
const pic = vertical('Pic.tsx')
const preview = read('src/components/lyric/LyricPreview.tsx')

test('June 定稿：四种底部弹出页保持纵向生命周期', () => {
  has(read('src/screens/Home/Vertical/PlayDetailOverlay.tsx'), /useBottomPopupTransition\(screenHeight, 'player'\)/, '播放详情底部 hook')
  for (const path of ['shareCard/ShareCardPage.tsx', 'playlist/SmartPlaylistEditor.tsx', 'playlist/PlaylistImportFlow.tsx']) {
    const source = read(`src/components/${path}`)
    has(source, /useBottomPopupTransition\(height, 'modal', true\)/, path)
    has(source, /requestClose\(finishClose\)/, `${path} 退出后卸载`)
    lacks(source, /useSettingsTransition|translateX|animationType="slide"/, `${path} 不叠加横向或原生时钟`)
  }
  const popup = read('src/components/common/bottomPopupTransition.ts')
  has(popup, /translateY: progress.interpolate\(\{\s*inputRange: \[0, 1\], outputRange: \[height, 0\]/, '上下进出')
  has(popup, /duration: kind === 'player' \? 420 : duration/, '播放进入420')
  has(popup, /duration: kind === 'player' \? 300 : duration/, '播放退出300')
  has(popup, /Easing.out\(Easing.back\(1.05\)\)/, '进入 easing')
  has(popup, /Easing.out\(Easing.cubic\)/, '退出 easing')
  has(popup, /kind === 'modal' \? NativeModules.UtilsModule.modalSlideDuration/, 'Modal设备时长')
  has(popup, /Math.cos\(\(value \+ 1\) \* Math.PI\) \/ 2 \+ 0.5/, 'Modal cosine')
  has(popup, /outputRange: \[0, 0.5\]/, 'Modal压暗')
  lacks(popup, /style = useMemo\([\s\S]*?opacity:/, '内容无淡入淡出')
  const navigation = read('src/navigation/navigation.ts')
  has(navigation, /translationY: \{\s*from: windowSizeTools.getSize\(\).height,\s*to: 0,\s*duration: 420,\s*interpolation: \{ type: 'spring' \}/, '原生播放进入')
  has(navigation, /translationY: \{\s*from: 0,\s*to: windowSizeTools.getSize\(\).height,\s*duration: 300/, '原生播放退出')
})

test('June 定稿：顶栏按屏幕中线居中，字号15行高20、gap20', () => {
  const chrome = vertical('PlayerChrome.tsx')
  const tabs = style(chrome, 'tabs')
  for (const pattern of [/position: 'absolute'/, /left: 0/, /right: 0/, /alignItems: 'center'/, /justifyContent: 'center'/]) has(tabs, pattern, '独立全宽Tabs')
  has(style(chrome, 'tabsInner'), /gap: 20/, '顶栏gap')
  has(style(chrome, 'tab'), /paddingBottom: 6/, 'Tab底部留白')
  has(chrome, /PLAYER_ICON_TAP = 44/, '按钮行高')
  has(chrome, /top: statusBarHeight \+ 8/, '顶距')
  lacks(chrome, /\bsmall\b|tabSm/, '不回退小字号')
  has(read('src/theme/magazineType.ts'), /tab: \{ size: 15, lineHeight: 20, weightOn: '800' as const, weightOff: '600'/, '字阶')
  const textTabs = read('src/components/magazine/TextTabs.tsx')
  has(textTabs, /small \? magType.tabSm.size : magType.tab.size/, '非small使用15号')
  has(style(textTabs, 'tabOn'), /borderBottomWidth: 3/, '选中下划线')
})

test('June 定稿：月亮按完整倒计时宽度碰撞收起，无固定屏宽断点', () => {
  const layout = vertical('playerChromeLayout.ts')
  has(layout, /active && windowWidth \/ 2 - tabsWidth \/ 2 < fullPillWidth \+ shareWidth \+ gutter \+ minGap/, '严格小于才收起')
  has(layout, /fontSize \* \(3.2 \+ Math.max\(0, pill.length - 7\) \* 0.55\)/, '完整文案估宽')
  const chrome = vertical('PlayerChrome.tsx')
  has(chrome, /measuredTabsWidth \|\| 6 \* setSpText\(15\) \+ 2 \* styles.tabsInner.gap/, '实测与回退宽度')
  has(chrome, /setTabsWidth\(nativeEvent.layout.width\)/, '实测Tabs')
  has(chrome, /shareWidth: styles.iconBtn.width, gutter: styles.wrap.paddingHorizontal/, '缩放后的按钮与边距预算')
  const timer = vertical('SleepTimerBtn.tsx')
  has(timer, /fullPillWidth: estimateTimerLabelWidth\(pill, setSpText\(13\)\) \+ 20 \+ 3,\s*minGap: 8/, '胶囊预算')
  has(timer, /const showPill = !!pill && !compact/, '月亮与完整胶囊切换')
  has(timer, /<MdiIcon name="weather-night" size=\{22\}/, '月亮22')
  has(timer, /accessibilityLabel=\{pill \?/, '收起仍保留倒计时无障碍标签')
  has(timer, /onPress=\{\(\) => \{ setVisible\(true\) \}\}/, '打开面板')
  has(timer, /<SleepTimerSheet visible=\{visible\}[^\n]*info=\{info\}/, '面板保留定时数据')
})

test('June 定稿：纵向剩余高度只按2比1分给唱片上下', () => {
  for (const [name, min, grow] of [['flexGapSm', 24, 2], ['flexGapRecord', 30, 1], ['flexGapTitle', 8, 0], ['flexGapLyric', 0, 0]]) {
    const gap = style(pic, name)
    has(gap, new RegExp(`minHeight: ${min}\\b`), `${name} minHeight`)
    has(gap, new RegExp(`flexGrow: ${grow}\\b`), `${name} flexGrow`)
    has(gap, /flexShrink: 0/, `${name} 不收缩`)
  }
  has(style(pic, 'lyricPreviewSlot'), /marginBottom: 10\b/, 'June 2026-11-11：标题间距18→8，底部补偿10，唱片与控制区不移位')
  has(style(pic, 'scrollContent'), /flexGrow: 1/, '滚动内容填充')
  has(pic, /<\/ScrollView>\s*<PlayerTransport/, '控制区固定在滚动区外')
})

test('June 定稿：三行歌词不改变历史唱片预算', () => {
  for (const [name, value] of [['ABOVE', '48'], ['TITLE', '90'], ['LYRIC', '124'], ['GAPS', '30 + 18 + 0']]) {
    has(pic, new RegExp(`const PLAYER_RESERVED_${name} = ${value.replace(/\+/g, '\\+')}\\s*\\n`), `PLAYER_RESERVED_${name}`)
  }
  has(pic, /const PLAYER_DISC_MIN = 200\s*\n/, '唱片下限')
  const budget = extract(pic, /const discSize = useMemo\(\(\) => \{([\s\S]*?)\n {2}\},/, '尺寸计算')
  has(budget, /winSize.width - PAGE_GUTTER \* 2 - 16/, '宽预算')
  has(budget, /PLAYER_RESERVED_TITLE \+\s*PLAYER_RESERVED_LYRIC \+\s*PLAYER_RESERVED_GAPS/, 'June 2026-11-10 批准歌词预算恒定预留')
  has(budget, /scrollHeight - PLAYER_RESERVED_ABOVE - reservedBelow/, '实测视口')
  has(budget, /Math.max\(PLAYER_DISC_MIN, Math.min\(widthBased, heightBased\)\)/, '尺寸上下界')
})

test('June 定稿：仅播放页上叠21，顶部触摸条带让给译音胶囊', () => {
  has(pic, /<PlayerTransport\s+seekOverlapTop=\{21\}/, '播放页上叠21')
  lacks(vertical('Lyric.tsx'), /seekOverlapTop/, '歌词页不传上叠')
  const transport = vertical('PlayerTransport.tsx')
  has(transport, /seekOverlapTop = 0/, '默认无上叠')
  has(transport, /seekOverlapTop > 0\s*\? createStyle\(\{ overlap: \{ marginTop: -seekOverlapTop, zIndex: 1 \} \}\)/, '负margin与层级')
  has(style(pic, 'scroll'), /zIndex: 2/, '胶囊命中优先')
  const seek = vertical('components/SeekBar.tsx')
  has(style(seek, 'wrap'), /height: 44/, '触摸区高度')
  has(seek, /const TRACK_H = 2\s*\nconst FILL_H = 4/, '轨道和已播高度')
  has(vertical('playerTransportLayout.ts'), /paddingTop: 8/, '面板顶部留白')
  has(style(preview, 'actions'), /minHeight: 44/, '胶囊操作行')
  has(read('src/components/magazine/SecondaryButton.tsx'), /height: compact \? 28 : 44/, '紧凑胶囊实际高28，计入预览底部margin后基准可见空白约26')
})

test('June 定稿：迷你歌词三档自适应与实际附加行，280ms native上移交叉淡化', () => {
  has(style(preview, 'extra'), /height: 18\b/, '附加行高18')
  for (const values of [[32, 44, 17, 24], [27, 36, 16, 22], [22, 28, 14, 19]]) {
    const [neighborHeight, currentHeight, neighborSize, currentSize] = values
    has(preview, new RegExp(`neighborHeight: ${neighborHeight}, currentHeight: ${currentHeight}, neighborSize: ${neighborSize}, currentSize: ${currentSize}`), 'June 2026-11-12批准三档')
  }
  has(preview, /previousLine\?\.text \?\? ''/, '缺上一句留空')
  has(preview, /next\?\.text \?\? ''/, '缺下一句留空')
  has(preview, /<KaraokeLine line=\{current\} size=\{currentSize\} style=\{styles.current\} active=\{active\} singleLine/, '当前句自适应字号单行逐字高亮')
  has(style(preview, 'current'), /fontWeight: '800'/, '当前句800')
  assert.equal((preview.match(/<Text size=\{neighborSize\} color=\{r.faint\} numberOfLines=\{1\}/g) || []).length, 2, warning)
  has(preview, /Number\(showTranslation\) \+ Number\(showRoma\)/, '按当前句实际显示行计数')
  has(preview, /Boolean\(translation && lines\[index\]\?\.translation\)/, '当前句译文及开关')
  has(preview, /Boolean\(roma && lines\[index\]\?\.roma\)/, '当前句音译及开关')
  has(preview, /const LYRIC_RESIZE_MS = 200/, '字号行高短过渡')
  has(preview, /const LYRIC_LINES_HEIGHT = 108/, '三句加附加行恒高108，含操作区160')
  has(preview, /duration: 280,\s*easing: Easing.out\(Easing.cubic\),\s*useNativeDriver: true/, '换句动画参数')
  has(preview, /outputRange: \[1, 0\]/, '旧层淡出')
  has(preview, /outputRange: \[0, -step\]/, '旧层上移')
  has(preview, /opacity: transitioning \? progress : 1/, '新层淡入')
  has(preview, /outputRange: \[step \+ extraHeight, 0\]/, '新层上移')
})

test('June 定稿已知现状：相邻前拖会动画，后台返回前进一句也可能动画', () => {
  const condition = extract(preview, /const shouldAnimate = ([\s\S]*?)\n {4}if \(!shouldAnimate\)/, '动画条件')
  assert.equal(compact(condition), compact('active && before.active && before.lines === lines && index === before.index + 1 && Boolean(lines[before.index]) && Boolean(lines[index])'), warning)
  has(preview, /if \(!shouldAnimate\) \{\s*setOutgoing\(null\)\s*progress.setValue\(1\)\s*return/, '其他输入直接定位')
  has(preview, /progress.stopAnimation\(\)/, '停止旧动画')
  lacks(preview, /\bAppState\b|\bseek\b/, '没有seek或后台恢复专用抑制输入')
  has(read('src/screens/PlayDetail/index.tsx'), /<Vertical componentId=\{componentId\} active=\{visible\} backActive=\{nativeActive\}/, 'visible传给active')
  const verticalIndex = vertical('index.tsx')
  has(verticalIndex, /<Pic componentId=\{componentId\} active=\{active && pageIndex === 1\}/, '播放Tab决定active')
  has(pic, /<LyricPreview lines=\{lyricLines\} index=\{line\} active=\{active\}/, '预览没有额外来源标志')
  const appState = extract(verticalIndex, /AppState.addEventListener\('change', state => \{([\s\S]*?)\n {4}\}\)/, 'AppState监听')
  has(appState, /screenkeepAwake\(\)/, '后台监听管理常亮')
  has(appState, /screenUnkeepAwake\(\)/, '后台取消常亮')
  lacks(appState, /setActive|setPage|setOutgoing|progress|resetToPlayPage/, '后台监听不重置预览动画')
})
