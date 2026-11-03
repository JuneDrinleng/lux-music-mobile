// Content tests finish navigation immediately. settings-navigation.src-test exercises the real animation.
export const settingsTransitionMock = hooks => ({
  useSettingsSubpage(root, enabled = true, initial = root) {
    const [page, setPage] = hooks.useState(initial)
    return { page, pages: [page], setPage, style: {} }
  },
  SettingsSubpage: function SettingsSubpage({ pages, children }) { return children(pages.at(-1)) },
  useSettingsTransition: () => ({ style: {}, requestClose: done => done?.(), requestOpen() {} }),
  useSettingsBack() {},
  useSubpageActive: () => true,
})
