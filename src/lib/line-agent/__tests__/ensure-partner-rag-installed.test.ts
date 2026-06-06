/**
 * ensure-partner-rag-installed.test.ts — M3.2 lazy-install guard
 * (design 2026-06-07-line-oa-m3-2-rag-call-site-wiring-design.md, decision C §3).
 *
 * `ensurePartnerRagAnswerSourceInstalled` is the idempotent, single-flight,
 * timeout-bounded guard the dispatcher thunk calls on the rag path. It NEVER
 * flips a gate, NEVER reads real Notion (the installer is injected), and fails
 * CLOSED: a timeout / installer error propagates (→ the rag responder try/catch
 * converts it into the unavailable reply) and is NOT cached, so the next rag
 * message retries. A successful install is cached (installed once per instance).
 *
 * Pure unit level: fake installer + fake clock (`startTimeout`) + fake `log`.
 * Zero real Notion / SDK / network.
 */

import { describe, it, expect, afterEach } from 'vitest'
import {
  ensurePartnerRagAnswerSourceInstalled,
  resetPartnerRagInstallStateForTests,
  type PartnerRagInstallLogCode,
} from '../line/ensure-partner-rag-installed'
import { NotionRagIndexUnavailableError } from '../partner-group/notion-rag-answer-source'

afterEach(() => {
  resetPartnerRagInstallStateForTests()
})

/** A never-resolving promise — simulates a hung install / index build. */
function hang(): Promise<never> {
  return new Promise<never>(() => {})
}

/** Fake clock: a `startTimeout` that fires immediately (timeout elapsed). */
const fireNow = () => Promise.resolve()
/** Fake clock: a `startTimeout` that never fires (no timeout within budget). */
const neverFire = () => hang()

describe('ensurePartnerRagAnswerSourceInstalled', () => {
  it('first call invokes the installer exactly once and logs start+success', async () => {
    let calls = 0
    const logs: PartnerRagInstallLogCode[] = []

    await ensurePartnerRagAnswerSourceInstalled({
      installer: () => {
        calls++
        return { installed: true }
      },
      startTimeout: neverFire,
      log: (code) => logs.push(code),
    })

    expect(calls).toBe(1)
    expect(logs).toEqual(['partner_rag_install_start', 'partner_rag_install_success'])
  })

  it('is idempotent: after a successful install the installer is not invoked again', async () => {
    let calls = 0
    const installer = () => {
      calls++
      return { installed: true as const }
    }

    await ensurePartnerRagAnswerSourceInstalled({ installer, startTimeout: neverFire, log: () => {} })
    await ensurePartnerRagAnswerSourceInstalled({ installer, startTimeout: neverFire, log: () => {} })

    expect(calls).toBe(1)
  })

  it('single-flights concurrent first calls into one installer invocation', async () => {
    let calls = 0
    let release!: () => void
    const gate = new Promise<void>((r) => {
      release = r
    })
    const installer = async () => {
      calls++
      await gate
      return { installed: true as const }
    }

    const a = ensurePartnerRagAnswerSourceInstalled({ installer, startTimeout: neverFire, log: () => {} })
    const b = ensurePartnerRagAnswerSourceInstalled({ installer, startTimeout: neverFire, log: () => {} })
    release()
    await Promise.all([a, b])

    expect(calls).toBe(1)
  })

  it('times out a hung install: throws NotionRagIndexUnavailableError("timeout"), logs timeout', async () => {
    const logs: PartnerRagInstallLogCode[] = []

    await expect(
      ensurePartnerRagAnswerSourceInstalled({
        installer: hang, // never resolves
        startTimeout: fireNow, // timeout elapses first
        log: (code) => logs.push(code),
      }),
    ).rejects.toBeInstanceOf(NotionRagIndexUnavailableError)

    expect(logs).toEqual(['partner_rag_install_start', 'partner_rag_install_timeout'])
  })

  it('does NOT cache a timeout: a later call retries the installer', async () => {
    let calls = 0

    await expect(
      ensurePartnerRagAnswerSourceInstalled({
        installer: () => {
          calls++
          return hang()
        },
        startTimeout: fireNow,
        log: () => {},
      }),
    ).rejects.toBeInstanceOf(NotionRagIndexUnavailableError)

    // Recovery: clock no longer fires, installer now succeeds.
    await ensurePartnerRagAnswerSourceInstalled({
      installer: () => {
        calls++
        return { installed: true }
      },
      startTimeout: neverFire,
      log: () => {},
    })

    expect(calls).toBe(2)
  })

  it('does NOT cache an installer error: a later call retries; error propagates', async () => {
    let calls = 0
    const logs: PartnerRagInstallLogCode[] = []

    await expect(
      ensurePartnerRagAnswerSourceInstalled({
        installer: () => {
          calls++
          throw new Error('boom')
        },
        startTimeout: neverFire,
        log: (code) => logs.push(code),
      }),
    ).rejects.toThrow('boom')

    expect(logs).toEqual(['partner_rag_install_start', 'partner_rag_install_failed'])

    await ensurePartnerRagAnswerSourceInstalled({
      installer: () => {
        calls++
        return { installed: true }
      },
      startTimeout: neverFire,
      log: () => {},
    })

    expect(calls).toBe(2)
  })

  it('installer returns installed:false → does not throw, logs failed, is terminal (no retry)', async () => {
    let calls = 0
    const logs: PartnerRagInstallLogCode[] = []
    const installer = () => {
      calls++
      return { installed: false as const, reason: 'missing_notion_token' as const }
    }

    await ensurePartnerRagAnswerSourceInstalled({ installer, startTimeout: neverFire, log: (c) => logs.push(c) })
    await ensurePartnerRagAnswerSourceInstalled({ installer, startTimeout: neverFire, log: (c) => logs.push(c) })

    expect(calls).toBe(1) // terminal config outcome: logged once, not retried
    expect(logs).toEqual(['partner_rag_install_start', 'partner_rag_install_failed'])
  })

  it('emits ONLY fixed code labels — never a token / db id / Notion url', async () => {
    const logs: string[] = []
    const SECRET = 'secret_ntn_TOKEN123'
    await ensurePartnerRagAnswerSourceInstalled({
      installer: () => ({ installed: false, reason: 'missing_notion_token' }),
      startTimeout: neverFire,
      log: (code) => logs.push(code),
    })

    const allowed: PartnerRagInstallLogCode[] = [
      'partner_rag_install_start',
      'partner_rag_install_success',
      'partner_rag_install_failed',
      'partner_rag_install_timeout',
    ]
    for (const line of logs) {
      expect(allowed).toContain(line)
      expect(line).not.toContain(SECRET)
      expect(line).not.toMatch(/notion\.so|database|token|http/i)
    }
  })
})
