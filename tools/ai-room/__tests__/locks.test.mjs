import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  acquireLock,
  readLocks,
  releaseLock,
} from '../locks.mjs'

let stateDir

beforeEach(async () => {
  stateDir = await mkdtemp(path.join(tmpdir(), 'ai-room-locks-'))
})

afterEach(async () => {
  await rm(stateDir, { recursive: true, force: true })
})

describe('AI room locks', () => {
  it('acquires a write lock with an expiry', async () => {
    const lock = await acquireLock(
      {
        session: 'rc-travel',
        owner: 'private-room',
        actor: 'cc',
        task: 'implement-feature',
        mode: 'write',
        ttlMs: 60_000,
      },
      {
        stateDir,
        now: () => new Date('2026-06-05T13:00:00.000Z'),
      }
    )

    expect(lock).toEqual({
      session: 'rc-travel',
      owner: 'private-room',
      actor: 'cc',
      task: 'implement-feature',
      mode: 'write',
      acquiredAt: '2026-06-05T13:00:00.000Z',
      expiresAt: '2026-06-05T13:01:00.000Z',
    })
    await expect(readLocks({ stateDir })).resolves.toEqual([lock])
  })

  it('rejects a second unexpired lock on the same session', async () => {
    const options = {
      stateDir,
      now: () => new Date('2026-06-05T13:00:00.000Z'),
    }
    await acquireLock(
      {
        session: 'rc-travel',
        owner: 'private-room',
        actor: 'cc',
        task: 'first',
        mode: 'write',
        ttlMs: 60_000,
      },
      options
    )

    await expect(
      acquireLock(
        {
          session: 'rc-travel',
          owner: 'private-room',
          actor: 'codex',
          task: 'second',
          mode: 'write',
          ttlMs: 60_000,
        },
        options
      )
    ).rejects.toThrow(/already locked/)
  })

  it('replaces expired locks on the same session', async () => {
    await acquireLock(
      {
        session: 'rc-travel',
        owner: 'private-room',
        actor: 'cc',
        task: 'old',
        mode: 'write',
        ttlMs: 1_000,
      },
      {
        stateDir,
        now: () => new Date('2026-06-05T13:00:00.000Z'),
      }
    )

    const replacement = await acquireLock(
      {
        session: 'rc-travel',
        owner: 'private-room',
        actor: 'codex',
        task: 'new',
        mode: 'write',
        ttlMs: 60_000,
      },
      {
        stateDir,
        now: () => new Date('2026-06-05T13:00:02.000Z'),
      }
    )

    await expect(readLocks({ stateDir })).resolves.toEqual([replacement])
  })

  it('stores exclusive rebind locks and releases by session', async () => {
    await acquireLock(
      {
        session: 'rc-travel',
        owner: 'private-room',
        actor: 'eric',
        task: 'rebind',
        mode: 'exclusive',
        ttlMs: 300_000,
      },
      {
        stateDir,
        now: () => new Date('2026-06-05T13:00:00.000Z'),
      }
    )

    await releaseLock('rc-travel', { stateDir })

    await expect(readLocks({ stateDir })).resolves.toEqual([])
  })
})
