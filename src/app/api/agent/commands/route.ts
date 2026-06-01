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
 *   - It does NOT post to LINE. Posting permission is enforced by the command
 *     router and permissions layer; this route only returns the routing
 *     decision for the DC bot to act on.
 *   - It returns the RouterDecision the caller (DC bot) prints to Discord.
 *
 * M1 scope: this route NORMALIZES + ROUTES the command (draft vs.
 * post_to_partner_group vs. denied).  Handlers behind the router are stubs;
 * durable persistence is a Task 7/9 follow-up.  No customer auto-reply.
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
import { routeCommand } from '@/lib/line-agent/commands/router'
import { safeDefaultLlmClassifier } from '@/lib/line-agent/commands/intent'

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

  // ── 3. Route the command ────────────────────────────────────────────────────
  // Routing is gated by the permission layer.  With no sendTarget the router
  // returns a 'draft' decision; with an explicit valid sendTarget it returns
  // 'post_to_partner_group'.  The safe default classifier makes no API calls
  // and needs no keys — the deterministic pass handles known commands, and the
  // permission layer still gates the final action.  Handlers stay stubs in M1;
  // this route never posts to LINE itself.
  const decision = await routeCommand({
    command,
    llmClassifier: safeDefaultLlmClassifier,
  })

  return NextResponse.json(decision, { status: 200 })
}
