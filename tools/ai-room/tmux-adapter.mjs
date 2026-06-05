import { execFile as nodeExecFile } from 'node:child_process'

import { PROJECTS, listProjectKeys } from './projects.mjs'

export function resolveTmuxCommand(options = {}) {
  const mode = options.mode ?? process.env.AI_ROOM_TMUX_MODE ?? 'wsl'
  if (mode === 'native') {
    return { file: 'tmux', baseArgs: [] }
  }
  return { file: 'wsl', baseArgs: ['--exec', 'tmux'] }
}

export function getKnownSessionNames() {
  return listProjectKeys().flatMap((key) => {
    const project = PROJECTS[key]
    return [project.activeSession, project.legacySession]
  })
}

function assertKnownSession(session) {
  if (!getKnownSessionNames().includes(session)) {
    throw new Error(
      `Unknown tmux session "${session}". Expected one of: ${getKnownSessionNames().join(', ')}.`
    )
  }
}

function defaultExecFile(file, args) {
  return new Promise((resolve, reject) => {
    nodeExecFile(
      file,
      args,
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout
          error.stderr = stderr
          reject(error)
          return
        }
        resolve({ stdout: String(stdout), stderr: String(stderr) })
      }
    )
  })
}

export function createTmuxAdapter(options = {}) {
  const execFile = options.execFile ?? defaultExecFile
  const command = resolveTmuxCommand({ mode: options.mode })

  async function run(tmuxArgs) {
    return execFile(command.file, [...command.baseArgs, ...tmuxArgs])
  }

  return {
    async listSessions() {
      const { stdout } = await run(['list-sessions'])
      return parseSessionNames(stdout)
    },

    async capturePane(session) {
      assertKnownSession(session)
      const { stdout } = await run(['capture-pane', '-p', '-t', session])
      return stdout
    },

    async getCurrentPath(session) {
      assertKnownSession(session)
      const { stdout } = await run([
        'display-message',
        '-p',
        '-t',
        session,
        '-F',
        '#{pane_current_path}',
      ])
      return stdout.trim()
    },

    async sendKeys(session, text) {
      assertKnownSession(session)
      await run(['send-keys', '-t', session, '--', text, 'Enter'])
    },

    async interrupt(session) {
      assertKnownSession(session)
      await run(['send-keys', '-t', session, 'C-c'])
    },

    async newSession(session, cwd) {
      assertKnownSession(session)
      await run(['new-session', '-d', '-s', session, '-c', cwd])
    },

    async killSession(session) {
      assertKnownSession(session)
      await run(['kill-session', '-t', session])
    },
  }
}

export function parseSessionNames(stdout) {
  return String(stdout)
    .split(/\r?\n/)
    .map((line) => line.match(/^([^:]+):/)?.[1])
    .filter((name) => typeof name === 'string' && name !== '')
}
