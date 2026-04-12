import { createStyle } from '@/utils/tools'

export default createStyle({
  dialogContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e4e8ef',
    backgroundColor: '#f7f8fb',
    padding: 14,
    marginBottom: 14,
  },
  summaryMedia: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eceff4',
  },
  summaryMediaImage: {
    width: '100%',
    height: '100%',
  },
  summaryCountText: {
    fontWeight: '700',
  },
  summaryInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },
  summaryTitle: {
    fontWeight: '700',
    marginBottom: 3,
  },
  summarySubtitle: {
    fontWeight: '500',
    marginBottom: 2,
  },
  summaryNote: {
    lineHeight: 16,
  },
  list: {
    maxHeight: 332,
  },
  listContent: {
    paddingBottom: 2,
  },
  listItem: {
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  listItemDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e8ebf1',
    opacity: 0.58,
  },
  listItemTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  listItemTitle: {
    fontWeight: '600',
  },
  listItemSubtitle: {
    marginTop: 2,
  },
  listItemAction: {
    minWidth: 56,
    height: 30,
    marginLeft: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#d8dee8',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listItemActionDisabled: {
    borderColor: '#e4e7ec',
    backgroundColor: '#f3f4f6',
  },
  listItemActionText: {
    fontWeight: '600',
  },
  createWrap: {
    minHeight: 56,
    position: 'relative',
    marginBottom: 10,
  },
  createBtn: {
    minHeight: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d6dbe4',
    backgroundColor: '#fbfcfd',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  createBtnHidden: {
    opacity: 0,
  },
  createIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#eef1f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  createInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
})
