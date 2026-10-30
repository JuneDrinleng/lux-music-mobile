/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { type ComponentProps } from 'react'
import { Dock } from '@/components/magazine'
import { useProgress } from '@/store/player/hook'

type Props = Omit<ComponentProps<typeof Dock>, 'progress'> & { musicId: string | null }

// Keep progress ticks below the content tree; the player slot and callbacks come from the shell.
export default function DockContainer({ musicId, ...props }: Props) {
  const { progress } = useProgress()
  const normalizedProgress = !musicId || !Number.isFinite(progress) ? 0 : Math.max(0, Math.min(1, progress))

  return <Dock {...props} progress={normalizedProgress} />
}
