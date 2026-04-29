<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# Problem to solve

1. 现在在搜索到的歌单一键转存到一个新建歌单后，歌单会转存，但歌单页playlistTab并不会刷新展示刚刚为了转存而创建的新歌单，只有退出app后重新进入才会有

2. 从HomeTab点开的歌单详情页，左上角的还是头像框，按理说歌单详情页左上角这个头像框的位置应该是返回键（参考从playlistTab进入的歌单详情页）
3. 第一次未成功加载出的歌曲图片现在有概率是以空的形式呈现，应该多次刷新缓存，或者采用换源的歌曲图片的方式来优化呈现，实在不行则用占位图片保底而非用空图片/黑色内容来展示

# Feature to add

None

# Need to optimize

1. 美化将歌曲添加到歌单的交互，现行的弹窗需要被美化和组件化
2. 歌单详情页面点击导入后弹出的页面，参考临时播放列表页面来组件化并重构以优化界面设计

组件都放置在src/components内即可，根据情况合理命名和选择存放的文件夹，不要引入额外bug