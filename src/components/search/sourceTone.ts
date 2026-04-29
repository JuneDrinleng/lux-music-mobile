export interface SourceTone {
  text: string
  background: string
}

const sourceTagColorMap: Record<string, SourceTone> = {
  tx: { text: '#31c27c', background: '#ecfdf3' },
  wy: { text: '#d81e06', background: '#fef2f2' },
  kg: { text: '#2f88ff', background: '#eff6ff' },
  kw: { text: '#f59e0b', background: '#fffbeb' },
  mg: { text: '#e11d8d', background: '#fdf2f8' },
}

export const getSourceTone = (source: string): SourceTone => {
  return sourceTagColorMap[source.toLowerCase()] ?? { text: '#111827', background: '#e5e7eb' }
}
