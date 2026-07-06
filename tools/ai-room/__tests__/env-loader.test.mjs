import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadLocalEnv, parseEnvText } from '../env-loader.mjs'

let cwd

beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), 'ai-room-env-'))
})

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true })
})

describe('AI room env loader', () => {
  it('parses simple dotenv text without printing secrets', () => {
    expect(
      parseEnvText(`
        # comment
        AI_ROOM_PRIVATE_CHANNEL_ID=123
        AI_ROOM_DISCORD_TOKEN="abc.def"
        EMPTY=
      `)
    ).toEqual({
      AI_ROOM_PRIVATE_CHANNEL_ID: '123',
      AI_ROOM_DISCORD_TOKEN: 'abc.def',
      EMPTY: '',
    })
  })

  it('loads .env.local and does not override existing process env values', async () => {
    await writeFile(
      path.join(cwd, '.env.local'),
      'AI_ROOM_DISCORD_TOKEN=file-token\nAI_ROOM_PRIVATE_CHANNEL_ID=file-channel\n',
      'utf8'
    )
    const env = {
      AI_ROOM_DISCORD_TOKEN: 'shell-token',
    }

    const loaded = await loadLocalEnv({ cwd, env })

    expect(loaded).toEqual({
      loadedFiles: ['.env.local'],
      loadedKeys: ['AI_ROOM_PRIVATE_CHANNEL_ID'],
      skippedKeys: ['AI_ROOM_DISCORD_TOKEN'],
    })
    expect(env.AI_ROOM_DISCORD_TOKEN).toBe('shell-token')
    expect(env.AI_ROOM_PRIVATE_CHANNEL_ID).toBe('file-channel')
  })
})
