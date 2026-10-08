/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

export interface ChangelogInline {
  kind: 'text' | 'strong' | 'code'
  text: string
}

export interface ChangelogHeading {
  kind: 'heading'
  text: string
}

export interface ChangelogParagraph {
  kind: 'paragraph'
  inlines: ChangelogInline[]
}

export interface ChangelogItem {
  kind: 'item'
  inlines: ChangelogInline[]
}

export interface ChangelogGroup {
  kind: 'group'
  id: 'feat' | 'fix' | 'improve' | 'other'
  items: ChangelogInline[][]
}

export type ChangelogBlock = ChangelogHeading | ChangelogParagraph | ChangelogItem | ChangelogGroup

export interface ChangelogDocument {
  blocks: ChangelogBlock[]
  fallback: boolean
  raw: string
}

export function parseChangelog(input: unknown): ChangelogDocument
