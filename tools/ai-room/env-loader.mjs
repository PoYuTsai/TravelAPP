import { readFile } from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_ENV_FILES = ['.env.local', '.env']

export function parseEnvText(text) {
  const values = {}
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index === -1) continue

    const key = line.slice(0, index).trim()
    if (!key) continue
    values[key] = unquote(line.slice(index + 1).trim())
  }
  return values
}

export async function loadLocalEnv(options = {}) {
  const cwd = options.cwd ?? process.cwd()
  const env = options.env ?? process.env
  const files = options.files ?? DEFAULT_ENV_FILES
  const loadedFiles = []
  const loadedKeys = []
  const skippedKeys = []

  for (const file of files) {
    let text
    try {
      text = await readFile(path.join(cwd, file), 'utf8')
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      throw error
    }

    loadedFiles.push(file)
    const parsed = parseEnvText(text)
    for (const [key, value] of Object.entries(parsed)) {
      if (env[key] !== undefined) {
        skippedKeys.push(key)
        continue
      }
      env[key] = value
      loadedKeys.push(key)
    }
  }

  return {
    loadedFiles,
    loadedKeys,
    skippedKeys,
  }
}

function unquote(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }
  return value
}
