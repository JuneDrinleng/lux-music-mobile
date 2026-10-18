/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { useCallback, useEffect, useState } from 'react'
import { Animated, useWindowDimensions } from 'react-native'

import { useOverlaySlideTransition } from '@/components/common/overlaySlideTransition'
import { sharedLuxStyles, useLuxTheme } from '@/theme/LuxTheme'
import { magazineRoles } from '@/theme/magazineRoles'
import { createStyle } from '@/utils/tools'
import { useBackHandler } from '@/utils/hooks/useBackHandler'

import { selectStatsLayout } from '@/utils/memories/layout'
import { type ReportMonth } from '@/utils/memories/monthly'

import { MemoriesStatsPage } from './MemoriesStatsPage'
import { MonthlyReportPage } from './MonthlyReportPage'
import { ListeningStatsMagazine } from './ListeningStatsMagazine'
import { ListeningStatsReplay } from './ListeningStatsReplay'
import { useListeningStatsModel } from './useListeningStatsModel'

const useRootStyles = sharedLuxStyles((colors) => {
  const r = magazineRoles(colors)
  return createStyle({
    root: {
      flex: 1,
      backgroundColor: r.paper,
    },
  })
})

export interface ListeningStatsPageProps {
  onClose: () => void
  bottomPadding?: number
}

const ListeningStatsPage = ({ onClose, bottomPadding = 0 }: ListeningStatsPageProps) => {
  const styles = useRootStyles()
  useLuxTheme()
  const { width } = useWindowDimensions()
  const { style: sceneStyle, requestClose: animateClose } = useOverlaySlideTransition(width)
  const model = useListeningStatsModel()
  const [monthlyOpen, setMonthlyOpen] = useState(false)
  const [monthlyMonth, setMonthlyMonth] = useState<ReportMonth>()
  const [detail, setDetail] = useState<'stats' | 'replay' | null>(null)
  const layout = selectStatsLayout(model.memoriesLayout, model.pageStyle, detail != null)
  useEffect(() => {
    setDetail(null)
    setMonthlyOpen(false)
  }, [model.memoriesLayout])
  const openMonthly = (month?: ReportMonth) => {
    setMonthlyMonth(month)
    setMonthlyOpen(true)
  }
  const closeMonthly = () => {
    if (monthlyOpen) setMonthlyOpen(false)
    else requestClose()
  }

  const requestClose = useCallback(() => {
    animateClose(onClose)
  }, [animateClose, onClose])

  useBackHandler(useCallback(() => {
    if (monthlyOpen) setMonthlyOpen(false)
    else if (detail) setDetail(null)
    else requestClose()
    return true
  }, [detail, monthlyOpen, requestClose]))

  return (
    <Animated.View style={[styles.root, sceneStyle]}>
      {monthlyOpen || layout == 'monthly'
        ? <MonthlyReportPage key={monthlyMonth ? `${monthlyMonth.year}-${monthlyMonth.month}` : 'current'} initialMonth={monthlyMonth} model={model} onClose={closeMonthly} onOpenStats={!detail ? () => { setMonthlyOpen(false); setDetail('stats') } : undefined} bottomPadding={bottomPadding} />
        : layout == 'cards' || layout == 'timeline'
          ? <MemoriesStatsPage model={model} timeline={layout == 'timeline'} onClose={requestClose} onOpenMonthly={openMonthly} onOpenStats={() => { setDetail('stats') }} onOpenReplay={() => { model.setRange('year'); setDetail('replay') }} bottomPadding={bottomPadding} />
          : detail == 'replay' || layout == 'replay'
            ? <ListeningStatsReplay model={model} onOpenMonthly={openMonthly} onClose={() => { setDetail(null) }} bottomPadding={bottomPadding} />
            : <ListeningStatsMagazine model={model} onOpenMonthly={openMonthly} onClose={() => { setDetail(null) }} bottomPadding={bottomPadding} />}
    </Animated.View>
  )
}

export default ListeningStatsPage
