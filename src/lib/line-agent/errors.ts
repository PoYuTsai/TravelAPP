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
