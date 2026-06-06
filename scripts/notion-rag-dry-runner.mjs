#!/usr/bin/env node
/**
 * notion-rag-dry-runner.mjs
 *
 * Runtime bridge entry for the offline `notion-rag-dry-run` operator command.
 *
 * `scripts/agent-command.mjs` is plain Node ESM and cannot statically import the
 * TypeScript traverse (`src/lib/line-agent/notion/notion-rag-traverse.ts`) or a
 * real `@notionhq/client`. The command resolves its runner through a pluggable
 * seam: when enabled and nothing is injected, it calls a runtime loader that
 * returns `{ runDryRun, client }`. This module IS that loader.
 *
 * WIRING PROOF, NOT A LIVE CONNECTION. The loader ASSEMBLES the runtime from
 * injectable factories, gated by BOTH:
 *   1. an explicit env gate `AI_AGENT_NOTION_RAG_RUNTIME=real`, and
 *   2. a present `NOTION_TOKEN`.
 * The default `importTraverse` now GUARD-loads the TS traverse: under a TS
 * runtime it returns the real `runNotionRagTraverseDryRun`, under plain `node`
 * the `.ts` import throws and is swallowed → null. Either way it touches NO
 * Notion API (it only returns a pure function). The default `createClient` is
 * still not-wired (returns null), so a real gate + token with no injected client
 * still yields `{ client: null }` ⇒ the command projects `client_not_wired`.
 * The next knife replaces the createClient default with a real `@notionhq/client`
 * (+ a tsx operator runner so plain-node loads the traverse too); the command
 * layer's resolution order does NOT change.
 *
 * Leak guard (loader-owned, mirrors notion-rag-client.ts): a factory throw may
 * carry a token / db id / notion.so url, so it is caught and re-thrown as a
 * fixed, secret-free error. The command then collapses that to `client_error`.
 *
 * Contract:
 *   loadNotionRagDryRunRuntime({ env, importTraverse, createClient })
 *     → Promise<{ runDryRun, client }>
 *     runDryRun: (env, client) => Promise<NotionRagTraverseReport> | null
 *     client:    NotionRagClient | null
 *   A missing runDryRun OR client ⇒ the command projects `client_not_wired`.
 *   A factory throw ⇒ sanitized re-throw ⇒ the command projects `client_error`.
 */

/** Real-runtime gate — must be exactly "real" (trimmed) to attempt wiring. */
function isRealRuntimeMode(env) {
  return String(env?.AI_AGENT_NOTION_RAG_RUNTIME ?? '').trim() === 'real'
}

/** Read the Notion integration token; empty/missing ⇒ stay not-wired. */
function readNotionToken(env) {
  const token = String(env?.NOTION_TOKEN ?? '').trim()
  return token.length > 0 ? token : null
}

/**
 * Sanitized wiring error. Fixed, secret-free message/name so a leaked factory
 * error (token / db id / notion.so url) can never reach a caller, log, or stack.
 */
class NotionRagRuntimeWiringError extends Error {
  constructor() {
    super('Notion RAG runtime wiring failed')
    this.name = 'NotionRagRuntimeWiringError'
  }
}

/**
 * PRODUCTION default factory for `importTraverse` — GUARDED dynamic import of
 * the TS traverse (`runNotionRagTraverseDryRun`):
 *   - under a TS-capable runtime (vitest now, a tsx operator runner later) the
 *     import resolves and the real traverse function is returned;
 *   - under plain `node` (today's operator CLI) importing a `.ts` source throws
 *     (unknown extension); the throw is swallowed → null, so the loader stays
 *     safely not-wired and the command projects `client_not_wired`.
 * Loading the traverse alone does NOT touch the Notion API: it only returns a
 * pure function the loader later runs against an injected client.
 *
 * `importModule` is injectable so the plain-node failure path is testable
 * without depending on the host runtime. A swallowed import error can carry no
 * secret because nothing propagates — the factory just resolves to null.
 */
export async function importTraverseDefault(ctx = {}) {
  const {
    importModule = () => import('../src/lib/line-agent/notion/notion-rag-traverse.ts'),
  } = ctx
  try {
    const mod = await importModule()
    return mod?.runNotionRagTraverseDryRun ?? null
  } catch {
    return null
  }
}

/**
 * PRODUCTION default factory: not wired. A real cut replaces this with a real
 * `@notionhq/client` wrapped by createNotionRagClient. Returning null keeps real
 * mode safely not-wired until then — no real client, no API.
 */
async function notWiredCreateClient() {
  return null
}

/**
 * Assemble the dry-run runtime. Default factories stay not-wired; tests inject
 * fakes to prove the wiring shape. Off-gate / missing-token short-circuit BEFORE
 * any factory runs, so the safe path never assembles or leaks.
 */
export async function loadNotionRagDryRunRuntime(ctx = {}) {
  const {
    env = {},
    importTraverse = importTraverseDefault,
    createClient = notWiredCreateClient,
  } = ctx

  if (!isRealRuntimeMode(env)) {
    return { runDryRun: null, client: null }
  }

  const token = readNotionToken(env)
  if (!token) {
    // Real gate but no token: safe not-wired. Do NOT call the client factory.
    return { runDryRun: null, client: null }
  }

  let runDryRun
  let client
  try {
    runDryRun = await importTraverse({ env })
    client = await createClient({ env, token })
  } catch {
    // A factory error may carry a token / db id / notion.so url — re-throw a
    // fixed, secret-free error so nothing private survives to the command/log.
    throw new NotionRagRuntimeWiringError()
  }

  if (!runDryRun || !client) {
    return { runDryRun: null, client: null }
  }
  return { runDryRun, client }
}
