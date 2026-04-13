<!-- Lux Proprietary: repository-original documentation. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. -->

# Problem to solve

None

# Feature to add

None

# Need to optimize

1. 把歌单详情页组件化，现在是全都复合在PlaylistTab里，增加了代码维护难度
2. 美化将歌曲添加到歌单的交互，现行的弹窗需要被美化和组件化
3. 歌单详情页面点击导入后弹出的页面，面临底部手势条区域透明，顶部圆角区域背后有额外的矩形直角等问题，导致界面不美观，后续应该将该功能组件化并重构以优化界面设计

组件都放置在src/components内即可，根据情况合理命名和选择存放的文件夹，不要引入e'wai