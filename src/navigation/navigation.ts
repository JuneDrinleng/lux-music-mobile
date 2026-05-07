/* Modified by Lux Music: derived from the upstream LX Music Mobile source file. This file remains under Apache-2.0. See LICENSE-NOTICE.md. */

import { Navigation } from 'react-native-navigation'
// import { InteractionManager } from 'react-native'

import {
  LAUNCH_SCREEN,
  LOGIN_SCREEN,
  AGREEMENT_SCREEN,
  HOME_SCREEN,
  PLAY_DETAIL_SCREEN,
  COMMENT_SCREEN,
  LEADERBOARD_DETAIL_SCREEN,
} from './screenNames'

import themeState from '@/store/theme/state'
import playerState from '@/store/player/state'
import { getStatusBarStyle } from './utils'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { setBgPic } from '@/core/common'
import { resolveImageUri } from '@/utils/imageCache'


// const store = getStore()
// const getTheme = () => getter('common', 'theme')(store.getState())

export async function pushLaunchScreen() {
  const theme = themeState.theme

  return Navigation.setRoot({
    root: {
      stack: {
        children: [{
          component: {
            name: LAUNCH_SCREEN,
            options: {
              topBar: {
                visible: false,
                height: 0,
                drawBehind: false,
              },
              statusBar: {
                drawBehind: true,
                visible: true,
                style: getStatusBarStyle(theme.isDark),
                backgroundColor: 'transparent',
              },
              navigationBar: {
                backgroundColor: 'transparent',
              },
              layout: {
                componentBackgroundColor: theme['c-content-background'],
              },
            },
          },
        }],
      },
    },
  })
}

export async function pushLoginScreen() {
  const theme = themeState.theme

  return Navigation.setRoot({
    root: {
      stack: {
        children: [{
          component: {
            name: LOGIN_SCREEN,
            options: {
              topBar: {
                visible: false,
                height: 0,
                drawBehind: false,
              },
              statusBar: {
                drawBehind: true,
                visible: true,
                style: getStatusBarStyle(theme.isDark),
                backgroundColor: 'transparent',
              },
              navigationBar: {
                backgroundColor: 'transparent',
              },
              layout: {
                componentBackgroundColor: theme['c-content-background'],
              },
            },
          },
        }],
      },
    },
  })
}

export function pushAgreementScreen(componentId: string, docType?: 'pact' | 'cheat-tip') {
  const theme = themeState.theme

  requestAnimationFrame(() => {
    void Navigation.push(componentId, {
      component: {
        name: AGREEMENT_SCREEN,
        passProps: {
          docType: docType ?? 'pact',
        },
        options: {
          topBar: {
            visible: false,
            height: 0,
            drawBehind: false,
          },
          statusBar: {
            drawBehind: true,
            visible: true,
            style: getStatusBarStyle(theme.isDark),
            backgroundColor: 'transparent',
          },
          navigationBar: {
            drawBehind: true,
            backgroundColor: 'transparent',
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
        },
      },
    })
  })
}

export async function pushHomeScreen() {
  /*
    Navigation.setDefaultOptions({
      topBar: {
        background: {
          color: '#039893',
        },
        title: {
          color: 'white',
        },
        backButton: {
          title: '', // Remove previous screen name from back button
          color: 'white',
        },
        buttonColor: 'white',
      },
      statusBar: {
        style: 'light',
      },
      layout: {
        orientation: ['portrait'],
      },
      bottomTabs: {
        titleDisplayMode: 'alwaysShow',
      },
      bottomTab: {
        textColor: 'gray',
        selectedTextColor: 'black',
        iconColor: 'gray',
        selectedIconColor: 'black',
      },
    })
  */

  const theme = themeState.theme
  return Navigation.setRoot({
    root: {
      stack: {
        children: [{
          component: {
            name: HOME_SCREEN,
            options: {
              topBar: {
                visible: false,
                height: 0,
                drawBehind: false,
              },
              statusBar: {
                drawBehind: true,
                visible: true,
                style: getStatusBarStyle(theme.isDark),
                backgroundColor: 'transparent',
              },
              navigationBar: {
                drawBehind: true,
                backgroundColor: 'transparent',
              },
              layout: {
                componentBackgroundColor: theme['c-content-background'],
              },
              animations: {
                setRoot: {
                  enter: {
                    enabled: true,
                    waitForRender: true,
                    alpha: {
                      from: 0,
                      to: 1,
                      duration: 280,
                    },
                    translationY: {
                      from: 18,
                      to: 0,
                      duration: 280,
                    },
                  },
                  exit: {
                    enabled: true,
                    alpha: {
                      from: 1,
                      to: 0,
                      duration: 220,
                    },
                  },
                },
              },
            },
          },
        }],
      },
    },
  })
}
export function pushPlayDetailScreen(componentId: string, skipAnimation = false) {
  // 立即设置 bgPic 为当前歌曲封面，避免 PageContent 白底闪烁
  const pic = playerState.musicInfo.pic
  if (pic) {
    const picUrl = pic.startsWith('/') ? `file://${pic}` : pic
    setBgPic(picUrl)
    void resolveImageUri(picUrl)
  }

  /*
    Navigation.setDefaultOptions({
      topBar: {
        background: {
          color: '#039893',
        },
        title: {
          color: 'white',
        },
        backButton: {
          title: '', // Remove previous screen name from back button
          color: 'white',
        },
        buttonColor: 'white',
      },
      statusBar: {
        style: 'light',
      },
      layout: {
        orientation: ['portrait'],
      },
      bottomTabs: {
        titleDisplayMode: 'alwaysShow',
      },
      bottomTab: {
        textColor: 'gray',
        selectedTextColor: 'black',
        iconColor: 'gray',
        selectedIconColor: 'black',
      },
    })
  */
  requestAnimationFrame(() => {
    const theme = themeState.theme

    void Navigation.push(componentId, {
      component: {
        name: PLAY_DETAIL_SCREEN,
        options: {
          topBar: {
            visible: false,
            height: 0,
            drawBehind: false,
          },
          statusBar: {
            drawBehind: true,
            visible: true,
            style: getStatusBarStyle(theme.isDark),
            backgroundColor: 'transparent',
          },
          navigationBar: {
            drawBehind: true,
            backgroundColor: 'transparent',
          },
          layout: {
            // 使用黑色背景避免推入动画过程中的白屏闪烁
            componentBackgroundColor: '#000000',
          },
          animations: {
            push: skipAnimation ? {} : {
              content: {
                translationY: {
                  from: windowSizeTools.getSize().height,
                  to: 0,
                  duration: 420,
                  interpolation: { type: 'spring' },
                },
                alpha: {
                  from: 0.92,
                  to: 1,
                  duration: 420,
                },
              },
            },
            pop: skipAnimation ? {} : {
              content: {
                translationY: {
                  from: 0,
                  to: windowSizeTools.getSize().height,
                  duration: 300,
                },
                alpha: {
                  from: 1,
                  to: 0.92,
                  duration: 300,
                },
              },
            },
          },
        },
      },
    })
  })
}

export function pushCommentScreen(componentId: string) {
  /*
    Navigation.setDefaultOptions({
      topBar: {
        background: {
          color: '#039893',
        },
        title: {
          color: 'white',
        },
        backButton: {
          title: '', // Remove previous screen name from back button
          color: 'white',
        },
        buttonColor: 'white',
      },
      statusBar: {
        style: 'light',
      },
      layout: {
        orientation: ['portrait'],
      },
      bottomTabs: {
        titleDisplayMode: 'alwaysShow',
      },
      bottomTab: {
        textColor: 'gray',
        selectedTextColor: 'black',
        iconColor: 'gray',
        selectedIconColor: 'black',
      },
    })
  */
  requestAnimationFrame(() => {
    const theme = themeState.theme

    void Navigation.push(componentId, {
      component: {
        name: COMMENT_SCREEN,
        options: {
          topBar: {
            visible: false,
            height: 0,
            drawBehind: false,
          },
          statusBar: {
            drawBehind: true,
            visible: true,
            style: getStatusBarStyle(theme.isDark),
            backgroundColor: 'transparent',
          },
          navigationBar: {
            drawBehind: true,
            backgroundColor: 'transparent',
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
          animations: {
            push: {
              content: {
                translationX: {
                  from: windowSizeTools.getSize().width,
                  to: 0,
                  duration: 300,
                },
              },
            },
            pop: {
              content: {
                translationX: {
                  from: 0,
                  to: windowSizeTools.getSize().width,
                  duration: 300,
                },
              },
            },
          },
        },
      },
    })
  })
}

export function pushLeaderboardDetailScreen(componentId: string, info: { source: LX.OnlineSource, boardId: string, boardName?: string }) {
  const theme = themeState.theme

  requestAnimationFrame(() => {
    void Navigation.push(componentId, {
      component: {
        name: LEADERBOARD_DETAIL_SCREEN,
        passProps: info,
        options: {
          topBar: {
            visible: false,
            height: 0,
            drawBehind: false,
          },
          statusBar: {
            drawBehind: true,
            visible: true,
            style: getStatusBarStyle(theme.isDark),
            backgroundColor: 'transparent',
          },
          navigationBar: {
            drawBehind: true,
            backgroundColor: 'transparent',
          },
          layout: {
            componentBackgroundColor: theme['c-content-background'],
          },
          animations: {
            push: {
              content: {
                translationX: {
                  from: windowSizeTools.getSize().width,
                  to: 0,
                  duration: 300,
                },
              },
            },
            pop: {
              content: {
                translationX: {
                  from: 0,
                  to: windowSizeTools.getSize().width,
                  duration: 300,
                },
              },
            },
          },
        },
      },
    })
  })
}
