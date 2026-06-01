/**
 * Typed errors for the LINE OA agent layer.
 *
 * AgentConfigError is thrown by loadAgentConfig() when one or more required
 * environment variables are absent.  All missing vars are collected before
 * throwing so callers get the full list in one shot.
 */
export class AgentConfigError extends Error {
  /** Every env-var key that was absent at validation time. */
  readonly missingVars: string[]

  constructor(missingVars: string[]) {
    const list = missingVars.join(', ')
    super(`[AgentConfigError] Missing required environment variables: ${list}`)
    this.name = 'AgentConfigError'
    this.missingVars = missingVars
    // Restore prototype chain in compiled ES5 output
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/**
 * Thrown when persisting a case to the durable store fails.
 *
 * This error is the signal the webhook route uses to FAIL LOUD: a case-persist
 * failure must propagate so the webhook returns HTTP 500 and LINE re-delivers
 * the event (at-least-once delivery is our durable buffer — see the M2 plan's
 * "Hard Rule").  Swallowing it and acking 200 would silently drop the case.
 *
 * It deliberately wraps ONLY store I/O failures.  Pure logic guards (e.g. a
 * reducer mismatch) are NOT persistence errors — wrapping those would cause an
 * un-fixable event to retry forever.
 */
export class CasePersistenceError extends Error {
  /** The LINE user whose case failed to persist. */
  readonly lineUserId: string

  constructor(lineUserId: string, options?: { cause?: unknown }) {
    super(
      `[CasePersistenceError] Failed to persist case for lineUserId "${lineUserId}". ` +
        'The webhook must return 500 so LINE retries (at-least-once delivery).'
    )
    this.name = 'CasePersistenceError'
    this.lineUserId = lineUserId
    if (options && 'cause' in options) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
    Object.setPrototypeOf(this, new.target.prototype)
  }
}
