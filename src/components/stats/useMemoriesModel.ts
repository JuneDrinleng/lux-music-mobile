/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useMemo, useState } from 'react'

import { getActiveSpace } from '@/utils/dataSpace'
import { emptyMilestoneState } from '@/utils/memories/milestones'
import { evaluateMilestones, ignoreMilestone } from '@/utils/memories/store'
import { buildMemoryTimeline, visibleMilestones } from '@/utils/memories/timeline'
import { onThisDay } from '@/utils/memories/onThisDay'
import { toast } from '@/utils/tools'

import { type ListeningStatsModel } from './useListeningStatsModel'

export const useMemoriesModel = ({ records, now, t }: ListeningStatsModel) => {
  const space = getActiveSpace()
  const [saved, setSaved] = useState<{ space: string, state: ReturnType<typeof emptyMilestoneState>, records: typeof records | null }>({ space, state: emptyMilestoneState(), records: null })
  const [failed, setFailed] = useState(false)
  // Never expose the previous account's achievements during a history reload.
  const state = useMemo(() => saved.space == space ? saved.state : emptyMilestoneState(), [saved, space])
  useEffect(() => {
    let active = true
    setFailed(false)
    void evaluateMilestones(records).then(result => {
      if (active && getActiveSpace() == space) setSaved({ space, state: result.state, records })
    }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [records, space])
  const ignore = useCallback((id: string) => {
    if (getActiveSpace() != space) return
    void ignoreMilestone(id).then(next => {
      if (getActiveSpace() == space) {
        setSaved({ space, state: next, records })
        toast(t('memories_ignored'))
      }
    }).catch(() => { toast(t('memories_save_failed')) })
  }, [space, t, records])
  const history = useMemo(() => records.filter(record => record.startedAt <= now), [records, now])
  const days = useMemo(() => onThisDay(history, now), [history, now])
  const milestones = useMemo(() => saved.space == space && saved.records == records ? visibleMilestones(history, state) : [], [history, state, saved, space, records])
  const timeline = useMemo(() => buildMemoryTimeline(history, state, now), [history, state, now])
  return { days, milestones, timeline, ignore, failed }
}
