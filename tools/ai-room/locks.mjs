import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { DEFAULT_STATE_DIR } from './events.mjs'

const LOCKS_FILE = 'locks.json'

function locksPath(stateDir) {
  return path.join(stateDir, LOCKS_FILE)
}

function toDate(now) {
  const value = now()
  return value instanceof Date ? value : new Date(value)
}

export async function readLocks(options = {}) {
  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR
  let raw
  try {
    raw = await readFile(locksPath(stateDir), 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
  return JSON.parse(raw)
}

async function writeLocks(locks, options = {}) {
  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR
  await mkdir(stateDir, { recursive: true })
  await writeFile(locksPath(stateDir), `${JSON.stringify(locks, null, 2)}\n`, 'utf8')
}

export async function acquireLock(input, options = {}) {
  const nowFn = options.now ?? (() => new Date())
  const now = toDate(nowFn)
  const existing = await readLocks(options)
  const activeLocks = existing.filter((lock) => new Date(lock.expiresAt) > now)
  const conflicting = activeLocks.find((lock) => lock.session === input.session)
  if (conflicting) {
    throw new Error(
      `Session "${input.session}" is already locked by ${conflicting.actor} for ${conflicting.task}.`
    )
  }

  const lock = {
    session: input.session,
    owner: input.owner,
    actor: input.actor,
    task: input.task,
    mode: input.mode,
    acquiredAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + input.ttlMs).toISOString(),
  }

  await writeLocks([...activeLocks, lock], options)
  return lock
}

export async function releaseLock(session, options = {}) {
  const existing = await readLocks(options)
  await writeLocks(
    existing.filter((lock) => lock.session !== session),
    options
  )
}
