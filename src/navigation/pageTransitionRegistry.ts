/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

/** Native buttons and JS back handlers must await the same outgoing page. */
const pages = new Map<string, () => Promise<unknown>>()
export const registerPageClose = (id: string, close: () => Promise<unknown>) => {
  pages.set(id, close)
  return () => { if (pages.get(id) === close) pages.delete(id) }
}
export const getRegisteredPageClose = (id: string) => pages.get(id)

/** JS page container owns the animation, including native stack pages. */
export const subpageNavigationOptions = {
  animations: { push: { enabled: false }, pop: { enabled: false } },
  popGesture: false,
}
