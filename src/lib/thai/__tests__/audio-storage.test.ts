import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveThaiAudioTarget } from '../audio-storage'

const projectRoot = path.resolve(__dirname, '../../../..')

describe('resolveThaiAudioTarget', () => {
  it('maps a phrase and speed to the exact public mp3 target', () => {
    const target = resolveThaiAudioTarget({
      phraseId: 'kho-thot-kha',
      speed: 'natural',
      projectRoot,
    })

    expect(target.phrase.id).toBe('kho-thot-kha')
    expect(target.publicPath).toBe('/audio/thai/basics/greetings/kho-thot-kha-natural.mp3')
    expect(target.filePath).toBe(
      path.join(projectRoot, 'public/audio/thai/basics/greetings/kho-thot-kha-natural.mp3')
    )
  })

  it('rejects an unknown phrase id before writing anything', () => {
    expect(() =>
      resolveThaiAudioTarget({
        phraseId: '../wrong',
        speed: 'natural',
        projectRoot,
      })
    ).toThrow('Unknown Thai phrase')
  })
})
