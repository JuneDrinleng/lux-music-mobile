/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useMemo } from 'react'
import { Text as RNText, View } from 'react-native'

import Text from '@/components/common/Text'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { parseChangelog, type ChangelogGroup, type ChangelogInline } from '@/utils/changelogFormat'

const Inlines = ({ parts }: { parts: ChangelogInline[] }) => (
  <>
    {parts.map((part, index) => {
      if (part.kind == 'strong') return <RNText key={index} style={styles.strong}>{part.text}</RNText>
      if (part.kind == 'code') return <RNText key={index} style={styles.code}>{part.text}</RNText>
      return <RNText key={index}>{part.text}</RNText>
    })}
  </>
)

const BulletList = ({ items, compact }: { items: ChangelogInline[][], compact: boolean }) => (
  <>
    {items.map((item, index) => (
      <View key={index} style={compact ? styles.listRowCompact : styles.listRow}>
        <View style={compact ? styles.bulletWrapCompact : styles.bulletWrap}>
          <View style={compact ? styles.bulletCompact : styles.bullet} />
        </View>
        <Text size={compact ? 13 : 15} color={compact ? '#374151' : '#20242d'} style={compact ? styles.listTextCompact : styles.listText}>
          <Inlines parts={item} />
        </Text>
      </View>
    ))}
  </>
)

const groupLabel = (t: (key: 'changelog_group_feat' | 'changelog_group_fix' | 'changelog_group_improve' | 'changelog_group_other') => string, id: ChangelogGroup['id']) => {
  if (id == 'feat') return t('changelog_group_feat')
  if (id == 'fix') return t('changelog_group_fix')
  if (id == 'improve') return t('changelog_group_improve')
  return t('changelog_group_other')
}

interface ChangelogViewProps {
  desc: string
  compact?: boolean
}

const ChangelogView = ({ desc, compact = false }: ChangelogViewProps) => {
  const t = useI18n()
  const doc = useMemo(() => parseChangelog(desc), [desc])
  if (doc.fallback) {
    return (
      <Text size={compact ? 13 : 15} color={compact ? '#4b5563' : '#20242d'} style={compact ? styles.paragraphCompact : styles.paragraph}>
        {doc.raw}
      </Text>
    )
  }
  return (
    <View>
      {doc.blocks.map((block, index) => {
        if (block.kind == 'heading') {
          return (
            <Text key={`h-${index}`} size={compact ? 14 : 15} color={compact ? '#111827' : '#20242d'} style={compact ? styles.headingCompact : styles.heading}>
              {block.text}
            </Text>
          )
        }
        if (block.kind == 'paragraph') {
          return (
            <Text key={`p-${index}`} size={compact ? 13 : 15} color={compact ? '#374151' : '#20242d'} style={compact ? styles.paragraphCompact : styles.paragraph}>
              <Inlines parts={block.inlines} />
            </Text>
          )
        }
        if (block.kind == 'group') {
          return (
            <View key={`g-${block.id}`}>
              <Text size={compact ? 14 : 15} color={compact ? '#111827' : '#20242d'} style={compact ? styles.headingCompact : styles.heading}>
                {groupLabel(t, block.id)}
              </Text>
              <BulletList items={block.items} compact={compact} />
            </View>
          )
        }
        return <BulletList key={`i-${index}`} items={[block.inlines]} compact={compact} />
      })}
    </View>
  )
}

const styles = createStyle({
  paragraph: {
    lineHeight: 22,
    marginBottom: 8,
  },
  paragraphCompact: {
    lineHeight: 18,
    marginBottom: 6,
  },
  heading: {
    fontWeight: '600',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 6,
  },
  headingCompact: {
    fontWeight: '700',
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  listRowCompact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  bulletWrap: {
    width: 16,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletWrapCompact: {
    width: 14,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#20242d',
  },
  bulletCompact: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#374151',
  },
  listText: {
    flex: 1,
    lineHeight: 22,
  },
  listTextCompact: {
    flex: 1,
    lineHeight: 18,
  },
  strong: {
    fontWeight: '700',
  },
  code: {
    fontFamily: 'monospace',
  },
})

export default ChangelogView
