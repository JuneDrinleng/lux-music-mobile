/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { SettingsSubpage, useSettingsSubpage } from '@/components/common/SettingsPage'
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
  const { page: route, pages, setPage: setRoute, style: subpageStyle } = useSettingsSubpage<'root' | 'monthly' | 'report' | 'replay'>('root')
  const monthlyOpen = route === 'monthly'
  const reportOpen = route === 'report'
  const replayOpen = route === 'replay'
  const [monthlyMonth, setMonthlyMonth] = useState<ReportMonth>()
  useEffect(() => {
    setRoute('root')
  }, [model.memoriesLayout, setRoute])
  const openMonthly = (month?: ReportMonth) => {
    setMonthlyMonth(month)
    setRoute('monthly')
  }
  const closeReport = () => {
    if (route === 'root') animateClose(onClose)
    else setRoute('root')
  }

  const requestClose = useCallback(() => {
    animateClose(onClose)
  }, [animateClose, onClose])

  useBackHandler(useCallback(() => {
    if (monthlyOpen || reportOpen || replayOpen) {
      setRoute('root')
    } else requestClose()
    return true
  }, [monthlyOpen, reportOpen, replayOpen, requestClose, setRoute]))

  return (
    <Animated.View style={[styles.root, sceneStyle]}><SettingsSubpage pages={pages} style={subpageStyle}>{route => {
      const monthlyOpen = route === 'monthly'
      const replayOpen = route === 'replay'
      const layout = selectStatsLayout(model.memoriesLayout, model.pageStyle, route === 'report')
      return <>
      {monthlyOpen || layout == 'monthly'
        ? <MonthlyReportPage key={monthlyMonth ? `${monthlyMonth.year}-${monthlyMonth.month}` : 'current'} initialMonth={monthlyMonth} model={model} onClose={closeReport} bottomPadding={bottomPadding} />
        : !replayOpen && (layout == 'cards' || layout == 'timeline')
            ? <MemoriesStatsPage model={model} timeline={layout == 'timeline'} onClose={closeReport} onOpenMonthly={openMonthly} onOpenReplay={() => { model.setRange('year'); setRoute('replay') }} bottomPadding={bottomPadding} />
            : replayOpen || layout == 'replay'
              ? <ListeningStatsReplay model={model} onOpenMonthly={() => { setMonthlyMonth(undefined); setRoute('report') }} onClose={replayOpen ? closeReport : requestClose} bottomPadding={bottomPadding} />
              : <ListeningStatsMagazine model={model} onOpenMonthly={() => { setMonthlyMonth(undefined); setRoute('report') }} onClose={requestClose} bottomPadding={bottomPadding} />}
    </>
    }}</SettingsSubpage></Animated.View>
  )
}

export default ListeningStatsPage
