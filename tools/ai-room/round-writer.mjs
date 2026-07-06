import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { DEFAULT_STATE_DIR } from './events.mjs'

export async function writeRoundFile(input, options = {}) {
  const stateDir = options.stateDir ?? DEFAULT_STATE_DIR
  const now = options.now ?? (() => new Date().toISOString())
  const current = now()
  const iso = typeof current === 'string' ? current : current.toISOString()
  const filename = `${formatRoundTimestamp(iso)}-${input.focus}.md`
  const relativePath = path.posix.join('tmp/ai-room/rounds', filename)
  const absolutePath = path.join(stateDir, 'rounds', filename)

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, formatRoundMarkdown(input), 'utf8')

  return { relativePath, absolutePath }
}

function formatRoundTimestamp(iso) {
  const match = String(iso).match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  )
  if (!match) return 'unknown-time'
  const [, year, month, day, hour, minute, second] = match
  return `${year}-${month}-${day}-${hour}${minute}${second}`
}

function formatRoundMarkdown({ focus, project, session, capturedText }) {
  return [
    `Focus: ${focus}`,
    `Project: ${project}`,
    `Session: ${session}`,
    '',
    'Captured Round:',
    '',
    String(capturedText ?? '').trim(),
    '',
  ].join('\n')
}
