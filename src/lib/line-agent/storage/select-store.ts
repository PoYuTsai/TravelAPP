/**
 * Production store bootstrap.
 *
 * Chooses the concrete CaseStore implementation based on the environment:
 *
 *   - KV env present (AGENT_KV_URL + AGENT_KV_TOKEN) → KvStore (durable).
 *   - No KV env, non-production                       → MemoryStore (local/test).
 *   - No KV env, production                           → THROW (fail closed).
 *
 * FAIL CLOSED rationale: in a serverless production deployment, a missing KV
 * config must be a hard failure — NOT a silent fall back to MemoryStore.  An
 * in-memory store on serverless looks healthy but forgets every case on the
 * next invocation, turning "durable persistence" into silent data loss.
 */

import type { CaseStore } from './store'
import { KvStore } from './kv-store'
import { MemoryStore } from './memory-store'

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

export class StoreBootstrapError extends Error {
  constructor() {
    super(
      '[StoreBootstrapError] Durable KV store is required in production but ' +
        'AGENT_KV_URL / AGENT_KV_TOKEN are not set. Refusing to fall back to ' +
        'MemoryStore, which would silently forget every case on a serverless ' +
        'instance. Configure the Upstash/Marketplace Redis env vars.'
    )
    this.name = 'StoreBootstrapError'
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

function hasKvEnv(): boolean {
  return Boolean(process.env.AGENT_KV_URL && process.env.AGENT_KV_TOKEN)
}

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL)
}

/**
 * Select the CaseStore for the current environment.
 *
 * @throws {StoreBootstrapError} in production when KV env is missing.
 */
export function selectStore(): CaseStore {
  if (hasKvEnv()) {
    return new KvStore()
  }
  if (isProductionRuntime()) {
    throw new StoreBootstrapError()
  }
  return new MemoryStore()
}
