import * as list from './list'
import * as dislike from './dislike'
import * as source from './source'
// export * as theme from './theme'


export const callObj = Object.assign({},
  list.handler,
  dislike.handler,
  source.handler,
)


export const modules = {
  list,
  dislike,
}

export const featureVersion = {
  list: 1,
  dislike: 1,
  playHistory: 1,
  source: 1,
} as const
