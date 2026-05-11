import path from 'node:path'
import { thaiPhrases } from './phrases'
import type { ThaiPhrase } from './types'

export type ThaiAudioSpeed = 'natural' | 'slow'

type ResolveThaiAudioTargetInput = {
  phraseId: string
  speed: ThaiAudioSpeed
  projectRoot?: string
}

type ThaiAudioTarget = {
  phrase: ThaiPhrase
  publicPath: string
  filePath: string
}

export function resolveThaiAudioTarget({
  phraseId,
  speed,
  projectRoot = process.cwd(),
}: ResolveThaiAudioTargetInput): ThaiAudioTarget {
  const phrase = thaiPhrases.find((item) => item.id === phraseId)

  if (!phrase) {
    throw new Error(`Unknown Thai phrase: ${phraseId}`)
  }

  const publicPath = phrase.audio[speed]

  if (!publicPath.startsWith('/audio/thai/') || !publicPath.endsWith('.mp3')) {
    throw new Error(`Invalid Thai audio path: ${publicPath}`)
  }

  const filePath = path.join(projectRoot, 'public', publicPath)
  const audioRoot = path.join(projectRoot, 'public', 'audio', 'thai')
  const relative = path.relative(audioRoot, filePath)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Thai audio path escapes audio folder: ${publicPath}`)
  }

  return {
    phrase,
    publicPath,
    filePath,
  }
}
