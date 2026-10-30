/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export const fieldOperators = {
  artist: ['contains', 'notContains', 'equals', 'notEquals'],
  title: ['contains', 'notContains', 'equals', 'notEquals'],
  album: ['contains', 'notContains', 'equals', 'notEquals'],
  source: ['equals', 'notEquals'],
  playCount: ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte'],
  duration: ['equals', 'notEquals', 'gt', 'gte', 'lt', 'lte'],
  lastPlayed: ['before', 'after', 'withinDays', 'notWithinDays'],
  addedDate: ['before', 'after', 'withinDays', 'notWithinDays'],
  liked: ['equals', 'notEquals'],
} as const
export type RuleField = keyof typeof fieldOperators
export type Rule = { [F in RuleField]: {
  field: F
  operator: typeof fieldOperators[F][number]
  /** Duration is seconds; absolute dates are epoch ms; relative dates are days. */
  value: F extends 'liked' ? boolean : F extends 'artist' | 'title' | 'album' | 'source' ? string : number
} }[RuleField]
export interface RuleSet {
  match: 'all' | 'any'
  rules: Rule[]
  sort: { field: RuleField | 'library', direction: 'asc' | 'desc' }
  /** Omitted means no limit. Count is always calculated before limiting. */
  limit?: number
}
export interface SmartPlaylistDefinition {
  playlistId: string
  name: string
  autoRefresh: boolean
  ruleSet: RuleSet
}
const object = (value: unknown): value is Record<string, unknown> => value != null && typeof value == 'object' && !Array.isArray(value)
const field = (value: unknown): value is RuleField => typeof value == 'string' && Object.prototype.hasOwnProperty.call(fieldOperators, value)
export const isRuleSet = (value: unknown): value is RuleSet => {
  if (!object(value) || !['all', 'any'].includes(String(value.match)) || !Array.isArray(value.rules) || value.rules.length > 100) return false
  if (!object(value.sort) || !(value.sort.field == 'library' || field(value.sort.field)) || !['asc', 'desc'].includes(String(value.sort.direction))) return false
  if (value.limit !== undefined && (typeof value.limit != 'number' || !Number.isSafeInteger(value.limit) || value.limit < 1)) return false
  return value.rules.every(rule => {
    if (!object(rule) || !field(rule.field) || !(fieldOperators[rule.field] as readonly unknown[]).includes(rule.operator)) return false
    if (rule.field == 'liked') return typeof rule.value == 'boolean'
    if (['artist', 'title', 'album', 'source'].includes(rule.field)) return typeof rule.value == 'string' && rule.value.trim().length > 0
    return typeof rule.value == 'number' && Number.isFinite(rule.value) && rule.value >= 0 && (rule.field != 'playCount' || Number.isSafeInteger(rule.value))
  })
}
export const isSmartPlaylistDefinition = (value: unknown): value is SmartPlaylistDefinition => object(value) &&
  typeof value.playlistId == 'string' && value.playlistId.trim().length > 0 &&
  typeof value.name == 'string' && value.name.trim().length > 0 && typeof value.autoRefresh == 'boolean' && isRuleSet(value.ruleSet)
