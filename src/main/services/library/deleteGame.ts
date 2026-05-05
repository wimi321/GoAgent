import { existsSync, unlinkSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import { appHome, findGame, removeGame } from '@main/lib/store'
import type { LibraryGame } from '@main/lib/types'
import { detachGameFromStudents } from '../studentProfile'

function isManagedAppFile(filePath: string): boolean {
  const root = resolve(appHome)
  const target = resolve(filePath)
  const distance = relative(root, target)
  return distance.length > 0 && !distance.startsWith('..') && !isAbsolute(distance)
}

function removeManagedGameFile(game: LibraryGame): boolean {
  if (!game.filePath || !isManagedAppFile(game.filePath) || !existsSync(game.filePath)) {
    return false
  }
  unlinkSync(game.filePath)
  return true
}

export function deleteLibraryGame(gameId: string): { deleted: LibraryGame; removedFile: boolean } {
  const game = findGame(gameId)
  if (!game) {
    throw new Error(`找不到棋谱: ${gameId}`)
  }

  const removedFile = removeManagedGameFile(game)
  const deleted = removeGame(gameId)
  if (!deleted) {
    throw new Error(`找不到棋谱: ${gameId}`)
  }
  detachGameFromStudents(gameId)
  return { deleted, removedFile }
}
