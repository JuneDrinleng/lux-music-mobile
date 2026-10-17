/* Lux Proprietary: repository-original source file. See LICENSE-NOTICE.md and PROPRIETARY_FILES.md. */

import { existsFile, mkdir, privateStorageDirectoryPath, readFile, rename, stat, unlink, writeFile } from '@/utils/fs'
import type { SpaceId } from './index'

export const avatarDirectory = (spaceId: SpaceId): string => `${privateStorageDirectoryPath}/user/${encodeURIComponent(spaceId)}`

// Always rebuild the temporary file. Neither a temp nor an unpublished destination
// left by a terminated process is evidence of a complete copy.
export const migrateAvatar = async(raw: string, spaceId: SpaceId): Promise<string> => {
  const avatar = JSON.parse(raw) as string | null
  if (!avatar) return raw
  const source = avatar.replace(/^file:\/\//, '')
  if (!source.startsWith(`${privateStorageDirectoryPath}/user/avatar.`) || !await existsFile(source)) return raw
  const ext = source.slice(source.lastIndexOf('.') + 1)
  if (!['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) return raw
  const directory = avatarDirectory(spaceId)
  if (!await existsFile(directory)) await mkdir(directory)
  const destination = `${directory}/avatar.${ext}`
  const temporary = `${destination}.migration-tmp`
  if (await existsFile(temporary)) await unlink(temporary)
  const original = await stat(source)
  await writeFile(temporary, String(await readFile(source, 'base64')), 'base64')
  if (!await existsFile(temporary) || (await stat(temporary)).size != original.size) throw new Error('Avatar copy verification failed')
  if (!(await rename(temporary, `avatar.${ext}`))) throw new Error('Avatar copy rename failed')
  if (!await existsFile(destination) || (await stat(destination)).size != original.size) throw new Error('Avatar destination verification failed')
  return JSON.stringify(destination)
}
