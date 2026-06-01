/**
 * POST /api/agent/commands
 *
 * Internal operator command endpoint — the HTTP entry point for the DC/Discord
 * bot and backend workers to submit commands to the agent bridge.
 *
 * Security:
 *   - Requires the AI_AGENT_INTERNAL_SECRET header (x-agent-secret).
 *   - Returns 401 when the secret is missing or invalid.
 *   - Returns 400 when the command body is malformed.
 *
 * What this endpoint does NOT do:
 *   - It does NOT post to LINE. Posting permission is enforced by the Task 6
 *     command router and permissions layer.
 *   - It returns an OperatorResponse that the caller (DC bot) prints to Discord.
 *
 * NOTE: Native Discord interaction / slash-command route is deferred until
 * the internal HTTP bridge is verified working end-to-end. Do NOT add it here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateOperatorAuth } from '@/lib/line-agent/operator/operator-auth'
import {
  parseOperatorCommand,
  type OperatorCommandInput,
} from '@/lib/line-agent/operator/operator-command'
import { buildAcknowledgement, buildErrorResponse } from '@/lib/line-agent/operator/operator-response'

// The expected secret is read from env at request time so tests can inject it
// via environment without module-level caching issues.
function getExpectedSecret(): string {
  return process.env.AI_AGENT_INTERNAL_SECRET ?? ''
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Auth ────────────────────────────────────────────────────────────────
  const providedSecret = request.headers.get('x-agent-secret')
  const authResult = validateOperatorAuth(getExpectedSecret(), providedSecret)

  if (!authResult.ok) {
    return NextResponse.json(
      { error: authResult.message, code: authResult.code },
      { status: 401 }
    )
  }

  // ── 2. Parse body ──────────────────────────────────────────────────────────
  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.', code: 'INVALID_BODY' },
      { status: 400 }
    )
  }

  const parseResult = parseOperatorCommand(rawBody as OperatorCommandInput)

  if (!parseResult.ok) {
    return NextResponse.json(
      { error: parseResult.message, code: parseResult.code },
      { status: 400 }
    )
  }

  const command = parseResult.command

  // ── 3. Build response ──────────────────────────────────────────────────────
  // Produce a deterministic acknowledgement / draft response.
  // The actual command execution (routing, LLM calls, LINE posting) is handled
  // by the Task 6 command router.  For now we acknowledge and return.
  const response = buildAcknowledgement(command)

  return NextResponse.json(response, { status: 200 })
}
