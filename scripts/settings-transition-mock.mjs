// Content tests finish navigation immediately. settings-navigation.src-test exercises the real animation.
export const settingsTransitionMock = hooks => ({
  useSettingsSubpage(root, enabled = true, initial = root) {
    const [page, setPage] = hooks.useState(initial)
    return { page, setPage, style: {} }
  },
  useSettingsTransition: () => ({ style: {}, requestClose: done => done?.(), requestOpen() {} }),
  useSettingsBack() {},
})
