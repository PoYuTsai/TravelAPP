/**
 * ensure-partner-rag-installed.ts — M3.2 lazy-install guard (design
 * 2026-06-07-line-oa-m3-2-rag-call-site-wiring-design.md, decision C §3).
 *
 * The dispatcher's `answerSource` thunk reaches the rag path ONLY when every
 * surfacing precondition holds (partner group + botDirected + explicit intent +
 * BOTH env gates on). On that — and only that — path it `await`s this guard
 * BEFORE invoking the source, so the real Notion answer source is installed
 * lazily, once, on the first eligible request. Gate off / OA / untagged / no
 * intent ⇒ the thunk never runs ⇒ this guard is never called ⇒ zero install,
 * zero SDK import, zero Notion read (the structural gate IS the gate; this guard
 * adds no env check of its own).
 *
 * Invariants:
 *  - **Idempotent.** A resolved attempt (installed OR a definitive config
 *    not-installed) is terminal: the installer runs at most once per instance.
 *  - **Single-flight.** Concurrent first calls share one in-flight attempt.
 *  - **Timeout-bounded, fail-closed.** The install / index build races a timeout;
 *    on timeout it throws `NotionRagIndexUnavailableError('timeout')`. A timeout
 *    or an installer error is NOT cached, so the next eligible message retries;
 *    the throw propagates to `createRagPartnerGroupResponder`'s try/catch, which
 *    yields the unavailable reply — never a fabricated draft.
 *  - **SDK-free static graph.** The default installer is `import()`-ed lazily, so
 *    importing this module (and `webhook-runtime`) never pulls `@notionhq/client`.
 *  - **Leak-safe logs.** Only fixed code labels are logged — never a token, db id,
 *    or Notion url.
 *
 * It flips NO env gate and writes NO Sanity / calls NO LLM.
 */

import { NotionRagIndexUnavailableError } from '../partner-group/notion-rag-answer-source'

/** Sanitized, code-only log labels (design §3.7) — never a secret. */
export type PartnerRagInstallLogCode =
  | 'partner_rag_install_start'
  | 'partner_rag_install_success'
  | 'partner_rag_install_failed'
  | 'partner_rag_install_timeout'

/** Structural shape of an install outcome (mirrors InstallDefaultPartnerRagResult). */
export interface PartnerRagInstallOutcome {
  installed: boolean
  reason?: string
}

/** The install seam. Default = the real (lazy-imported) bootstrap; fake in tests. */
export type PartnerRagInstaller = () =>
  | PartnerRagInstallOutcome
  | Promise<PartnerRagInstallOutcome>

export interface EnsurePartnerRagInstalledDeps {
  /** Install seam. Defaults to the lazy-imported `installDefaultPartnerRagAnswerSource`. */
  installer?: PartnerRagInstaller
  /** Timeout budget for the install / index build (ms). */
  timeoutMs?: number
  /**
   * Timeout primitive (the injectable "clock"). Resolves AFTER `ms` to signal the
   * budget elapsed. Default uses an unref'd `setTimeout`; tests inject a fake that
   * fires immediately or never.
   */
  startTimeout?: (ms: number) => Promise<void>
  /** Code-only logger. Defaults to `console.info`; tests spy. */
  log?: (code: PartnerRagInstallLogCode) => void
}

/**
 * Default timeout for the install / index build. The Notion read must not hold
 * the LINE reply-token window open indefinitely; on overrun we fail closed.
 */
export const DEFAULT_PARTNER_RAG_INSTALL_TIMEOUT_MS = 8_000

// ---------------------------------------------------------------------------
// Module-singleton state (per function instance on Fluid Compute)
// ---------------------------------------------------------------------------

/** Terminal flag: the installer has resolved (installed OR definitively not). */
let _done = false
/** Single-flight handle for the in-progress first attempt. */
let _inflight: Promise<void> | null = null
/**
 * Optional install-seam override. Lets a test (or a future bootstrap) substitute
 * the default lazy-imported installer for the NO-deps thunk call path, so the
 * dispatcher's gate behavior / fail-closed wiring can be exercised without the
 * real SDK. Resolution order: per-call `deps.installer` › this override › default.
 */
let _installer: PartnerRagInstaller | null = null

/** Override the install seam for the no-deps (thunk) call path. */
export function setPartnerRagInstaller(installer: PartnerRagInstaller | null): void {
  _installer = installer
}

/**
 * Default install seam: lazily `import()` the SDK composition root so the static
 * import graph of this module (and webhook-runtime) stays free of
 * `@notionhq/client`. Only ever reached on the gate-on rag path.
 */
const defaultInstaller: PartnerRagInstaller = async () => {
  const mod = await import('./install-default-partner-rag')
  return mod.installDefaultPartnerRagAnswerSource()
}

function defaultStartTimeout(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms)
    // Don't keep the process/test runner alive solely for this safety timer.
    ;(timer as { unref?: () => void }).unref?.()
  })
}

function defaultLog(code: PartnerRagInstallLogCode): void {
  console.info(`[line-agent] partner-rag install: ${code}`)
}

/**
 * Ensure the partner-group RAG answer source is installed. Idempotent +
 * single-flight; fail-closed (throws on timeout / installer error, NOT cached).
 * Resolves to void on a terminal outcome (installed OR a definitive config
 * not-installed); the caller then invokes the installed (or fail-closed
 * not-wired) source.
 */
export async function ensurePartnerRagAnswerSourceInstalled(
  deps: EnsurePartnerRagInstalledDeps = {},
): Promise<void> {
  if (_done) return
  if (_inflight) return _inflight

  const installer = deps.installer ?? _installer ?? defaultInstaller
  const timeoutMs = deps.timeoutMs ?? DEFAULT_PARTNER_RAG_INSTALL_TIMEOUT_MS
  const startTimeout = deps.startTimeout ?? defaultStartTimeout
  const log = deps.log ?? defaultLog

  const attempt = runInstallOnce(installer, timeoutMs, startTimeout, log)
  _inflight = attempt
  try {
    await attempt
    // Reached only when the attempt RESOLVED (no timeout / error): terminal.
    _done = true
  } finally {
    // Clear the single-flight handle either way. On a thrown attempt `_done`
    // stays false, so the next eligible message retries (timeout/error not cached).
    _inflight = null
  }
}

async function runInstallOnce(
  installer: PartnerRagInstaller,
  timeoutMs: number,
  startTimeout: (ms: number) => Promise<void>,
  log: (code: PartnerRagInstallLogCode) => void,
): Promise<void> {
  log('partner_rag_install_start')

  let outcome: PartnerRagInstallOutcome
  try {
    outcome = await Promise.race([
      // Defer the installer to a microtask so a synchronous throw is captured
      // into the race rather than escaping construction.
      Promise.resolve().then(installer),
      startTimeout(timeoutMs).then((): never => {
        throw new NotionRagIndexUnavailableError('timeout')
      }),
    ])
  } catch (error) {
    log(
      error instanceof NotionRagIndexUnavailableError
        ? 'partner_rag_install_timeout'
        : 'partner_rag_install_failed',
    )
    // Not cached: propagate so the rag responder fails closed AND the next
    // eligible message can retry.
    throw error
  }

  log(outcome.installed ? 'partner_rag_install_success' : 'partner_rag_install_failed')
}

/**
 * TEST-ONLY: reset the install singleton so each test starts from the not-wired
 * baseline. Never called by production code.
 */
export function resetPartnerRagInstallStateForTests(): void {
  _done = false
  _inflight = null
  _installer = null
}
