import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { writeRoundFile } from '../round-writer.mjs'

let stateDir

beforeEach(async () => {
  stateDir = await mkdtemp(path.join(tmpdir(), 'ai-room-rounds-'))
})

afterEach(async () => {
  await rm(stateDir, { recursive: true, force: true })
})

describe('round writer', () => {
  it('writes a timestamped round file for the current focus', async () => {
    const result = await writeRoundFile(
      {
        focus: 'travel',
        project: 'TravelAPP',
        session: 'rc-travel',
        capturedText:
          'Goal: build AI room\nChanged files: tools/ai-room\nNext action: review',
      },
      {
        stateDir,
        now: () => '2026-06-05T13:45:07.000Z',
      }
    )

    expect(result.relativePath).toBe(
      'tmp/ai-room/rounds/2026-06-05-134507-travel.md'
    )

    const raw = await readFile(result.absolutePath, 'utf8')
    expect(raw).toContain('Focus: travel')
    expect(raw).toContain('Project: TravelAPP')
    expect(raw).toContain('Session: rc-travel')
    expect(raw).toContain('Goal: build AI room')
  })
})
