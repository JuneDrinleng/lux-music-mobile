import { APP_LAYER_INDEX } from '@/config/constant'
import { sharedLuxStyles } from '@/theme/LuxTheme'
import { PAGE_GUTTER, SECTION_TO_LIST, magType } from '@/theme/magazineType'
import { createStyle } from '@/utils/tools'
import { StyleSheet } from 'react-native'

export const useAdminConsoleStyles = sharedLuxStyles((colors) => createStyle({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: APP_LAYER_INDEX.controls + 6,
    elevation: APP_LAYER_INDEX.controls + 6,
    backgroundColor: colors.bg.app,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: PAGE_GUTTER,
  },
  subpageTitle: {
    marginTop: 8,
    marginBottom: SECTION_TO_LIST,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  metricCell: {
    width: '50%',
    paddingVertical: 16,
    paddingRight: 8,
  },
  metricValue: {
    fontWeight: '800',
  },
  metricLabel: {
    marginTop: 6,
  },
  metricRuleRow: {
    width: '100%',
  },
  denyBody: {
    marginTop: 24,
    gap: 10,
  },
  denyHost: {
    marginTop: 8,
  },
  searchRow: {
    marginBottom: 12,
  },
  userRow: {
    paddingVertical: 12,
    gap: 4,
  },
  userRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  inviteRow: {
    paddingVertical: 12,
    gap: 4,
  },
  inviteActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 8,
  },
  detailBlock: {
    marginTop: 12,
    gap: 6,
  },
  playlistRow: {
    paddingVertical: 10,
  },
  deviceRow: {
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  note: {
    marginTop: 8,
    marginBottom: 12,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  refreshHint: {
    marginTop: 8,
    marginBottom: 4,
  },
  dangerText: {
    fontWeight: '700',
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 10,
  },
}))

export const adminMetricType = magType.sheetFigure
