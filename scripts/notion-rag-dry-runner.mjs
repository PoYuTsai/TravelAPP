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
 * The default `importTraverse` GUARD-loads the TS traverse: under a TS runtime
 * it returns the real `runNotionRagTraverseDryRun`, under plain `node` the `.ts`
 * import throws and is swallowed → null. The default `createClient` is now WIRED:
 * it dynamic-imports `@notionhq/client` + the TS adapter `notion-rag-client.ts`
 * and returns `createNotionRagClient(new Client({ auth: token }))`. Construction
 * touches NO Notion API — the API is first hit only when `runDryRun` later calls
 * `client.listPages`. Because the adapter is `.ts`, both default factories need a
 * TS-capable runtime; the operator runs this via `npm run agent:notion-rag-dry-run`
 * (tsx). Under plain `node`, the `.ts` imports throw → sanitized ⇒ `client_error`.
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
 * PRODUCTION default factory for `importSearch` — GUARDED dynamic import of the
 * TS operator search runtime (`runNotionRagSearch`). Same guard semantics as
 * importTraverseDefault: resolves under a TS runtime (tsx), swallowed → null
 * under plain node. Loading it touches no Notion API.
 */
export async function importSearchDefault(ctx = {}) {
  const {
    importModule = () => import('../src/lib/line-agent/notion/notion-rag-search.ts'),
  } = ctx
  try {
    const mod = await importModule()
    return mod?.runNotionRagSearch ?? null
  } catch {
    return null
  }
}

/**
 * PRODUCTION default factory for `importComposer` — GUARDED dynamic import of the
 * pure TS answer composer (`composeAnswer`). Same guard semantics as
 * importSearchDefault: resolves under a TS runtime (tsx), swallowed → null under
 * plain node. Loading it touches no Notion API and no LLM (composeAnswer is a
 * pure, deterministic function with the LLM refine hook left off).
 */
export async function importComposerDefault(ctx = {}) {
  const {
    importModule = () => import('../src/lib/line-agent/notion/notion-rag-answer-composer.ts'),
  } = ctx
  try {
    const mod = await importModule()
    return mod?.composeAnswer ?? null
  } catch {
    return null
  }
}

/**
 * PRODUCTION default factory for `createClient` — assembles a REAL Notion client:
 *   1. dynamic-import `@notionhq/client` for its `Client` constructor;
 *   2. dynamic-import the TS adapter `notion-rag-client.ts` for
 *      `createNotionRagClient`;
 *   3. `new Client({ auth: token })` (NO network — construction only stores
 *      config; the API is first touched later when runDryRun calls listPages);
 *   4. wrap the SDK as the loader-port `NotionRagClient` and return it.
 *
 * Both imports are injectable so the assembly is unit-testable fully offline.
 * Under plain `node` the `.ts` adapter import throws (unknown extension); that —
 * and any construction error — is caught and re-thrown SANITIZED, because a raw
 * import / SDK error may carry a token / db id / notion.so url. The loader also
 * sanitizes; this is defense in depth so a direct caller can never leak either.
 */
export async function createClientDefault(ctx = {}) {
  const {
    token,
    importClientModule = () => import('@notionhq/client'),
    importRagClientModule = () => import('../src/lib/line-agent/notion/notion-rag-client.ts'),
  } = ctx
  try {
    const clientMod = await importClientModule()
    const Client = clientMod?.Client
    const ragMod = await importRagClientModule()
    const createNotionRagClient = ragMod?.createNotionRagClient
    if (typeof Client !== 'function' || typeof createNotionRagClient !== 'function') {
      // Malformed modules → stay safely not-wired (command projects not_wired).
      return null
    }
    const notion = new Client({ auth: token })
    return createNotionRagClient(notion)
  } catch {
    // A raw import / construction error may carry a token / db id / notion.so
    // url — re-throw a fixed, secret-free error so nothing private survives.
    throw new NotionRagRuntimeWiringError()
  }
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
    createClient = createClientDefault,
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

/**
 * Assemble the operator search runtime — same gates and leak guard as the
 * dry-run loader, but resolves `runNotionRagSearch` instead of the traverse.
 * Off-gate / missing-token short-circuit BEFORE any factory runs.
 */
export async function loadNotionRagSearchRuntime(ctx = {}) {
  const {
    env = {},
    importSearch = importSearchDefault,
    createClient = createClientDefault,
  } = ctx

  if (!isRealRuntimeMode(env)) {
    return { runSearch: null, client: null }
  }

  const token = readNotionToken(env)
  if (!token) {
    return { runSearch: null, client: null }
  }

  let runSearch
  let client
  try {
    runSearch = await importSearch({ env })
    client = await createClient({ env, token })
  } catch {
    throw new NotionRagRuntimeWiringError()
  }

  if (!runSearch || !client) {
    return { runSearch: null, client: null }
  }
  return { runSearch, client }
}

/**
 * Assemble the operator ANSWER runtime — resolves `runSearch` (real corpus
 * retrieval) AND the pure `composeAnswer` (deterministic draft), plus the Notion
 * client. Same real-runtime gate, token gate, and sanitized leak guard as the
 * search loader. A missing runSearch / composeAnswer / client ⇒ the command
 * projects `client_not_wired`. No LLM and no message send are ever assembled.
 */
export async function loadNotionRagAnswerRuntime(ctx = {}) {
  const {
    env = {},
    importSearch = importSearchDefault,
    importComposer = importComposerDefault,
    createClient = createClientDefault,
  } = ctx

  if (!isRealRuntimeMode(env)) {
    return { runSearch: null, composeAnswer: null, client: null }
  }

  const token = readNotionToken(env)
  if (!token) {
    return { runSearch: null, composeAnswer: null, client: null }
  }

  let runSearch
  let composeAnswer
  let client
  try {
    runSearch = await importSearch({ env })
    composeAnswer = await importComposer({ env })
    client = await createClient({ env, token })
  } catch {
    throw new NotionRagRuntimeWiringError()
  }

  if (!runSearch || !composeAnswer || !client) {
    return { runSearch: null, composeAnswer: null, client: null }
  }
  return { runSearch, composeAnswer, client }
}
