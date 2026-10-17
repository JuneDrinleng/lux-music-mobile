import * as list from './list'
import * as dislike from './dislike'
import * as together from './together'
// export * as theme from './theme'


export const callObj = Object.assign({},
  list.handler,
  dislike.handler,
  together.handler,
)


export const modules = {
  list,
  dislike,
}

export const featureVersion = {
  list: 1,
  dislike: 1,
  playHistory: 1,
  together: 1,
} as const
