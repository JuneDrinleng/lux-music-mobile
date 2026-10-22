/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */
import { useEffect, useMemo, useState } from 'react'
import { FlatList, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { MagazineSheet, TextTabs } from '@/components/magazine'
import { MdiIcon } from '@/components/common/MdiIcon'
import { useI18n } from '@/lang'
import { magazineRoles } from '@/theme/magazineRoles'
import { useLuxTheme } from '@/theme/LuxTheme'
import { groupSimilar, type SimilarTab } from '@/utils/recommend/viewModel'
import { libraryCandidate } from '@/utils/recommend/local'
import { onDataSpaceWillChange } from '@/utils/dataSpace'
import { useRecommendations } from './useRecommendations'
import { enqueueRecommendations, playRecommendations, startRecommendationRadio } from './actions'
import { RecommendationButton, RecommendationSong, RecommendationStatus, useRecommendationAction, useRecommendationStyles } from './RecommendationViews'

export const SimilarSongsSheet = ({ musicInfo, onClose }: { musicInfo: LX.Music.MusicInfo, onClose: () => void }) => {
  const seed = useMemo(() => libraryCandidate(musicInfo).song, [musicInfo])
  const { batch, loading, failed, reload } = useRecommendations(seed)
  const [tab, setTab] = useState<SimilarTab>('all')
  const groups = groupSimilar(batch?.items ?? [])
  const t = useI18n()
  const r = magazineRoles(useLuxTheme().colors)
  const styles = useRecommendationStyles()
  const { height } = useWindowDimensions()
  const { run, pending } = useRecommendationAction()
  useEffect(() => onDataSpaceWillChange(onClose), [onClose])
  const tabs = (['all', 'artist', 'history', 'similar'] as const).map(id => ({
    id, label: id === 'all' ? t('recommend_tab_all', { count: groups.all.length }) : t(`recommend_tab_${id}`),
  }))
  const radio = async() => {
    const next = await startRecommendationRadio(seed)
    if (!next.items.length) throw new Error('No radio candidates')
    onClose()
  }
  return (
    <MagazineSheet visible onClose={onClose} heightRatio={Math.min(640 / height, 0.94)} recommendationLayout
      eyebrow={t('recommend_similar_eyebrow')} title={t('recommend_similar')}
      subject={<RecommendationSong song={seed} subject />}
      footerContent={
        <View style={styles.footer}>
          <RecommendationButton label={t('recommend_enqueue_all')} disabled={loading || pending || !groups[tab].length}
            onPress={() => { void run(async() => enqueueRecommendations(groups[tab]), t('recommend_enqueued')) }} />
          <RecommendationButton label={t('recommend_radio_from_seed')} fill grow disabled={loading || pending}
            onPress={() => { void run(radio, t('recommend_radio_started')) }} />
        </View>
      }>
      <View style={{ flex: 1 }}>
        <View>
          <TextTabs items={tabs} value={tab} onChange={id => { setTab(id as SimilarTab) }} scroll tabStyle={{ paddingVertical: 8 }} />
        </View>
        <RecommendationStatus loading={loading} failed={failed} failures={batch?.failures.length ?? 0}
          empty={!groups[tab].length} reload={() => { void reload(true) }} />
        <FlatList data={loading ? [] : groups[tab]} keyExtractor={item => item.key} showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <RecommendationSong song={item.song} item={item} disabled={pending || loading}
              onPress={() => { void run(async() => playRecommendations([item])) }}
              trailing={
                <TouchableOpacity style={styles.add} hitSlop={8} disabled={pending} accessibilityRole="button"
                  accessibilityLabel={t('recommend_enqueue_song', { name: item.song.name })}
                  onPress={event => { event.stopPropagation(); void run(async() => enqueueRecommendations([item]), t('recommend_enqueued')) }}>
                  <MdiIcon name="plus-circle-outline" size={18} color={r.ink} />
                </TouchableOpacity>
              } />
          )} />
      </View>
    </MagazineSheet>
  )
}
