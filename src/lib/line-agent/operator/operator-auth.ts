/**
 * operator-auth.ts
 *
 * Validates the internal secret used by the DC/operator command bridge.
 *
 * Security constraints:
 * - Uses timingSafeEqual to avoid timing-oracle attacks when comparing secrets.
 * - Never logs the secret value (expected or provided) under any code path.
 * - Returns a typed discriminated-union result instead of throwing.
 * - Handles arbitrary byte sequences gracefully (Unicode, binary, empty string).
 */

import { timingSafeEqual } from 'crypto'

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type OperatorAuthSuccess = {
  ok: true
  /** The authenticated actor identity. */
  actor: 'operator'
}

export type OperatorAuthFailure = {
  ok: false
  /** MISSING_SECRET — no secret was provided at all.
   *  INVALID_SECRET — a secret was provided but did not match.
   *  CONFIG_ERROR   — the expected secret is not configured (server misconfiguration).
   */
  code: 'MISSING_SECRET' | 'INVALID_SECRET' | 'CONFIG_ERROR'
  message: string
}

export type OperatorAuthResult = OperatorAuthSuccess | OperatorAuthFailure

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate the provided secret against the expected secret.
 *
 * @param expectedSecret - The secret value from server config (AI_AGENT_INTERNAL_SECRET).
 *                         Must not be logged.
 * @param providedSecret - The value extracted from the incoming request header.
 *                         Must not be logged.
 * @returns A typed result — never throws.
 */
export function validateOperatorAuth(
  expectedSecret: string,
  providedSecret: string | null | undefined
): OperatorAuthResult {
  // Guard: server misconfiguration — expected secret is empty/missing.
  if (!expectedSecret) {
    return {
      ok: false,
      code: 'CONFIG_ERROR',
      message: 'Operator auth is not configured on this server.',
    }
  }

  // Guard: caller did not supply a secret at all.
  if (!providedSecret) {
    return {
      ok: false,
      code: 'MISSING_SECRET',
      message: 'Missing operator secret.',
    }
  }

  // Timing-safe comparison.
  // timingSafeEqual requires equal-length buffers; when lengths differ we still
  // compare against the expected buffer to keep constant-time behaviour (the
  // extra work is cheap and hides length information from a timing attacker).
  try {
    const expectedBuf = Buffer.from(expectedSecret, 'utf8')
    const providedBuf = Buffer.from(providedSecret, 'utf8')

    // Compare lengths without short-circuiting on inequality.
    // We XOR the length check into the comparison result so the timing is
    // always dominated by the timingSafeEqual call on expectedBuf.
    const lengthMatch = expectedBuf.length === providedBuf.length

    // Always run timingSafeEqual on equal-size buffers to avoid the
    // "different lengths → throw" path leaking timing.
    // Pad/truncate providedBuf to match expected length for comparison.
    const paddedProvided = Buffer.alloc(expectedBuf.length)
    providedBuf.copy(paddedProvided, 0, 0, Math.min(providedBuf.length, expectedBuf.length))

    const contentMatch = timingSafeEqual(expectedBuf, paddedProvided)

    if (lengthMatch && contentMatch) {
      return { ok: true, actor: 'operator' }
    }
  } catch {
    // Buffer construction can theoretically fail with truly pathological input;
    // treat as auth failure — never propagate the exception.
  }

  return {
    ok: false,
    code: 'INVALID_SECRET',
    message: 'Invalid operator secret.',
  }
}
