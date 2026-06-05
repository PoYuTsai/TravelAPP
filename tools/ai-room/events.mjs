import { mkdir, readFile, appendFile } from 'node:fs/promises'
import path from 'node:path'

export const DEFAULT_STATE_DIR = 'tmp/ai-room'

function eventsPath(stateDir) {
  return path.join(stateDir, 'events.ndjson')
}

export async function appendEvent(event, options = {}) {
  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR
  const now = options.now ?? (() => new Date().toISOString())
  const record = {
    ts: now(),
    ...event,
  }

  await mkdir(stateDir, { recursive: true })
  await appendFile(eventsPath(stateDir), `${JSON.stringify(record)}\n`, 'utf8')
  return record
}

export async function readEvents(options = {}) {
  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR
  let raw
  try {
    raw = await readFile(eventsPath(stateDir), 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return []
    throw error
  }

  return raw
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line))
}
