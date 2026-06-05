import { describe, expect, it } from 'vitest'

import {
  createTmuxAdapter,
  getKnownSessionNames,
  resolveTmuxCommand,
} from '../tmux-adapter.mjs'

describe('tmux adapter', () => {
  it('uses wsl --exec tmux by default to avoid shell parsing', () => {
    expect(resolveTmuxCommand()).toEqual({
      file: 'wsl',
      baseArgs: ['--exec', 'tmux'],
    })
  })

  it('can use native tmux when requested', () => {
    expect(resolveTmuxCommand({ mode: 'native' })).toEqual({
      file: 'tmux',
      baseArgs: [],
    })
  })

  it('allowlists only configured rc/dc sessions', () => {
    expect(getKnownSessionNames()).toEqual([
      'rc-travel',
      'dc-travel',
      'rc-vibesync',
      'dc-vibesync',
    ])
  })

  it('sends user text as a single execFile argument, not a shell string', async () => {
    const calls = []
    const adapter = createTmuxAdapter({
      execFile: async (file, args) => {
        calls.push({ file, args })
        return { stdout: '', stderr: '' }
      },
    })

    await adapter.sendKeys('rc-travel', 'hello && rm -rf nope')

    expect(calls).toEqual([
      {
        file: 'wsl',
        args: [
          '--exec',
          'tmux',
          'send-keys',
          '-t',
          'rc-travel',
          '--',
          'hello && rm -rf nope',
          'Enter',
        ],
      },
    ])
  })

  it('rejects writes to unknown sessions before invoking tmux', async () => {
    const calls = []
    const adapter = createTmuxAdapter({
      execFile: async (file, args) => {
        calls.push({ file, args })
        return { stdout: '', stderr: '' }
      },
    })

    await expect(adapter.sendKeys('random-session', 'hello')).rejects.toThrow(
      /Unknown tmux session/
    )
    expect(calls).toEqual([])
  })

  it('parses tmux list-sessions output into session names', async () => {
    const adapter = createTmuxAdapter({
      execFile: async () => ({
        stdout:
          'dc-travel: 1 windows (created Fri Jun 5)\nrc-travel: 1 windows\n',
        stderr: '',
      }),
    })

    await expect(adapter.listSessions()).resolves.toEqual([
      'dc-travel',
      'rc-travel',
    ])
  })

  it('reads pane current path with an explicit tmux format argument', async () => {
    const calls = []
    const adapter = createTmuxAdapter({
      execFile: async (file, args) => {
        calls.push({ file, args })
        return {
          stdout: '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP\n',
          stderr: '',
        }
      },
    })

    await expect(adapter.getCurrentPath('rc-travel')).resolves.toBe(
      '/mnt/c/Users/eric1/OneDrive/Desktop/TravelAPP'
    )
    expect(calls).toEqual([
      {
        file: 'wsl',
        args: [
          '--exec',
          'tmux',
          'display-message',
          '-p',
          '-t',
          'rc-travel',
          '-F',
          '#{pane_current_path}',
        ],
      },
    ])
  })
})
