#!/usr/bin/env node
/**
 * refine-smoke-runner.mjs
 *
 * M3.4c Cut 2 — runtime bridge + masked report for the `refine-smoke` operator
 * command. `scripts/agent-command.mjs` is plain Node ESM and cannot statically
 * import the TypeScript refine harness / adapter / fixtures, nor the real
 * `@anthropic-ai/sdk`. This module is the seam it falls back to.
 *
 * WIRING PROOF, NOT AN AUTO-RUN. The loader ASSEMBLES the runtime from injectable
 * factories, gated by THREE env checks (mirroring M3.4a's dry-run loader):
 *   1. `AI_AGENT_REFINE_LLM_ENABLED === 'true'`  (feature gate)
 *   2. `AI_AGENT_REFINE_LLM_RUNTIME === 'real'`  (real-connection gate)
 *   3. `ANTHROPIC_API_KEY` present               (credential)
 * Only when all three pass does it dynamic-import the SDK. The SDK import lives
 * ONLY here, never in the TS adapter (whose `callModel` stays injectable + SDK-
 * free) — exactly as `@notionhq/client` lives only in notion-rag-dry-runner.mjs.
 *
 * Reason codes are fine-grained so the operator can tell WHY it is not running:
 *   disabled → runtime_not_real → missing_key → factory_unavailable → wired.
 *
 * Leak guard: a source-factory throw may carry the API key, so it is caught and
 * re-thrown as a fixed, secret-free `RefineLlmWiringError`. The command collapses
 * that to a sanitized error report.
 *
 * The report functions (`summarizeRefineSmoke` / `formatRefineSmokeReport`) are
 * pure and masked by construction: they surface guard COUNTS and rates only —
 * never a draft body, a prompt, a token, cost/revenue/profit, or customer PII.
 *
 * REAL SMOKE IS NEVER AUTO-RUN (M3.4c correction 4): even fully gated, the
 * operator runs `npm run agent:refine-smoke` by hand; CC/tmux does not.
 */

// ---------------------------------------------------------------------------
// Gates
// ---------------------------------------------------------------------------

function isRefineEnabled(env) {
  return String(env?.AI_AGENT_REFINE_LLM_ENABLED ?? '').trim() === 'true'
}

function isRealRuntimeMode(env) {
  return String(env?.AI_AGENT_REFINE_LLM_RUNTIME ?? '').trim() === 'real'
}

function readAnthropicKey(env) {
  const key = String(env?.ANTHROPIC_API_KEY ?? '').trim()
  return key.length > 0 ? key : null
}

/** Sanitized wiring error: fixed, secret-free name/message so a leaked factory
 * error (the API key) can never reach a caller, log, or stack. */
export class RefineLlmWiringError extends Error {
  constructor() {
    super('Refine LLM runtime wiring failed')
    this.name = 'RefineLlmWiringError'
  }
}

// ---------------------------------------------------------------------------
// Factories (injectable; defaults dynamic-import the TS lib / the SDK)
// ---------------------------------------------------------------------------

/**
 * PRODUCTION default `importRefineKit` — GUARDED dynamic import of the FOUR pure
 * TS pieces the smoke assembles:
 *   - refineCustomerItineraryDraft  (M3.4b harness + three deterministic guards)
 *   - scanRefinePromptLeak          (input tripwire → prompt_leak pre-check)
 *   - resolveRefineModel            (model label for the report)
 *   - REFINE_SMOKE_CASES            (deterministic fixture drafts + constraints)
 * Same guard semantics as the notion loaders: resolves under a TS runtime (tsx /
 * vitest), swallowed → null under plain `node`. Loading touches NO LLM (the
 * harness only runs the injected source) and NO network. A null (any piece
 * missing) keeps the loader safely not-wired.
 */
export async function importRefineKitDefault(ctx = {}) {
  const {
    importHarnessModule = () => import('../src/lib/line-agent/notion/customer-itinerary-refine.ts'),
    importAdapterModule = () => import('../src/lib/line-agent/notion/llm-refine-adapter.ts'),
    importCasesModule = () =>
      import('../src/lib/line-agent/notion/__fixtures__/refine-smoke-cases.ts'),
  } = ctx
  try {
    const harnessMod = await importHarnessModule()
    const adapterMod = await importAdapterModule()
    const casesMod = await importCasesModule()
    const kit = {
      refine: harnessMod?.refineCustomerItineraryDraft ?? null,
      scanPromptLeak: adapterMod?.scanRefinePromptLeak ?? null,
      resolveModel: adapterMod?.resolveRefineModel ?? null,
      resolveRescueModel: adapterMod?.resolveRescueRefineModel ?? null,
      cases: casesMod?.REFINE_SMOKE_CASES ?? null,
    }
    if (
      !kit.refine ||
      !kit.scanPromptLeak ||
      !kit.resolveModel ||
      !kit.resolveRescueModel ||
      !Array.isArray(kit.cases)
    ) {
      return null
    }
    return kit
  } catch {
    return null
  }
}

/**
 * PRODUCTION default `createSource` — assembles the REAL refine source PAIR
 * (M3.4d primary→rescue):
 *   1. dynamic-import `@anthropic-ai/sdk` for its `Anthropic` client (THE ONLY
 *      place the SDK is ever imported — the TS adapter stays SDK-free);
 *   2. dynamic-import the TS adapter for `createAnthropicRefineSource` +
 *      `resolveRescueRefineModel`;
 *   3. build ONE `callModel` (one `messages.create`, returns the concatenated
 *      text blocks) shared by both tiers;
 *   4. return `{ primarySource, rescueSource }` — the primary binds the default/
 *      env primary model, the rescue binds the resolved rescue model. Both still
 *      pre-scan the prompt for leaks and hand the candidate to the harness guards.
 * Construction touches NO network — the API is first hit only when the smoke
 * later calls a source. Both imports are injectable so this is unit-testable
 * fully offline.
 *
 * Failure split (Eric's Cut 2 requirement):
 *   - module RESOLUTION failure (SDK not installed, or `.ts` adapter under plain
 *     node) → return null → loader projects `factory_unavailable`. This path is
 *     graceful, hits NO API, and carries no key (the key is untouched until
 *     construction), so the report can say "SDK missing" plainly.
 *   - CONSTRUCTION failure (only reached once the SDK resolved) → re-throw
 *     SANITIZED, because the error may carry the API key.
 */
export async function createSourceDefault(ctx = {}) {
  const {
    apiKey,
    env = {},
    importSdkModule = () => import('@anthropic-ai/sdk'),
    importAdapterModule = () => import('../src/lib/line-agent/notion/llm-refine-adapter.ts'),
  } = ctx
  // 1. Resolve the modules. A MISSING SDK (`@anthropic-ai/sdk` not installed) or a
  //    `.ts` adapter under plain `node` makes the dynamic import throw — and that
  //    failure carries NO key (the key is only used at construction in step 2). So
  //    a resolution failure is GRACEFUL not-wired → null → factory_unavailable, an
  //    explicit Eric requirement: SDK-missing must NOT hit the API or look like a
  //    hard wiring error.
  let Anthropic
  let createAnthropicRefineSource
  let resolveRescueRefineModel
  try {
    const sdkMod = await importSdkModule()
    Anthropic = sdkMod?.default ?? sdkMod?.Anthropic
    const adapterMod = await importAdapterModule()
    createAnthropicRefineSource = adapterMod?.createAnthropicRefineSource
    resolveRescueRefineModel = adapterMod?.resolveRescueRefineModel
  } catch {
    // SDK not installed / adapter not loadable → safe not-wired, no key involved.
    return null
  }
  if (typeof Anthropic !== 'function' || typeof createAnthropicRefineSource !== 'function') {
    // Malformed modules → stay safely not-wired (command projects factory_unavailable).
    return null
  }

  // 2. Construct. Only here is the API key handled, so a construction error MAY
  //    carry it → re-throw a fixed, secret-free error so nothing private survives.
  try {
    const client = new Anthropic({ apiKey })
    const callModel = async ({ system, user, model }) => {
      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: user }],
      })
      const blocks = Array.isArray(response?.content) ? response.content : []
      return blocks
        .filter((b) => b?.type === 'text' && typeof b.text === 'string')
        .map((b) => b.text)
        .join('')
    }
    // Primary: no explicit model ⇒ adapter resolves default/env primary model.
    const primarySource = createAnthropicRefineSource({ apiKey, env, callModel })
    // Rescue: bind the resolved rescue model (sonnet by default / env override).
    const rescueModel =
      typeof resolveRescueRefineModel === 'function' ? resolveRescueRefineModel({ env }) : undefined
    const rescueSource = createAnthropicRefineSource({ apiKey, env, model: rescueModel, callModel })
    return { primarySource, rescueSource }
  } catch {
    throw new RefineLlmWiringError()
  }
}

// ---------------------------------------------------------------------------
// loadRefineLlmRuntime — the three-gate loader
// ---------------------------------------------------------------------------

/**
 * Assemble the refine smoke runtime. Off-gate / missing-key short-circuit BEFORE
 * any factory runs, so the safe path never imports the SDK or leaks. A source-
 * factory throw is re-thrown sanitized.
 *
 * Returns `{ status, reason, refineSource, rescueSource, kit }`:
 *   disabled          → skipped         (feature off)
 *   runtime_not_real  → skipped         (no real-connection intent)
 *   missing_key       → client_not_wired
 *   factory_unavailable → client_not_wired (kit or source pair unavailable, e.g. plain node)
 *   wired             → real            (primary + rescue source + kit non-null)
 */
export async function loadRefineLlmRuntime(ctx = {}) {
  const { env = {}, importRefineKit = importRefineKitDefault, createSource = createSourceDefault } = ctx

  const notWired = (reason) => ({
    status: reason === 'disabled' || reason === 'runtime_not_real' ? 'skipped' : 'client_not_wired',
    reason,
    refineSource: null,
    rescueSource: null,
    kit: null,
  })

  if (!isRefineEnabled(env)) return notWired('disabled')
  if (!isRealRuntimeMode(env)) return notWired('runtime_not_real')

  const apiKey = readAnthropicKey(env)
  if (!apiKey) {
    // Three gates but no credential: safe not-wired. Do NOT call the source factory.
    return notWired('missing_key')
  }

  let kit
  let pair
  try {
    kit = await importRefineKit({ env })
    pair = await createSource({ env, apiKey })
  } catch {
    // A factory error may carry the API key — re-throw sanitized.
    throw new RefineLlmWiringError()
  }

  const refineSource = pair?.primarySource ?? null
  const rescueSource = pair?.rescueSource ?? null
  if (!kit || !refineSource) return notWired('factory_unavailable')

  return { status: 'real', reason: 'wired', refineSource, rescueSource, kit }
}

// ---------------------------------------------------------------------------
// summarizeRefineSmoke — pure aggregation + reason mapping
// ---------------------------------------------------------------------------

/** Harness RefineResult.rejectionReasons → report reason. prompt_leak is the
 * runner-only pre-check path and never appears in a RefineResult. The harness now
 * emits `structural_diff` directly (M3.4d rename), so that mapping is identity. */
const REFINE_REASON_MAP = {
  lint_error: 'lint',
  structural_diff: 'structural_diff',
  internal_leak: 'forbidden_terms',
  source_error: 'source_error',
  empty_output: 'empty_output',
}

function countErrors(issues) {
  if (!Array.isArray(issues)) return 0
  return issues.filter((i) => i?.severity === 'error').length
}

/**
 * Group structuralDiffGuard issues by their `code` (the masked sub-reason key —
 * a fact CATEGORY only, never a value/name/date/amount). Insertion-ordered so the
 * report is deterministic and reads in the guard's natural top-to-bottom order.
 * Returns a plain object { reason: count }.
 */
function groupStructuralReasons(issues) {
  const counts = new Map()
  if (Array.isArray(issues)) {
    for (const i of issues) {
      const reason = typeof i?.code === 'string' && i.code ? i.code : 'unknown'
      counts.set(reason, (counts.get(reason) ?? 0) + 1)
    }
  }
  return Object.fromEntries(counts)
}

/** `struct=0` when clean; `struct=N(reasonA=x, reasonB=y)` when facts drifted. */
function formatStructCount(structural) {
  const entries = Object.entries(structural ?? {})
  const total = entries.reduce((sum, [, c]) => sum + c, 0)
  if (total === 0) return 'struct=0'
  return `struct=${total}(${entries.map(([r, c]) => `${r}=${c}`).join(', ')})`
}

/** Did this RefineResult escalate to the rescue tier (i.e. a second attempt ran)? */
function rescueAttempted(result) {
  return Array.isArray(result?.attempts) && result.attempts.length > 1
}

/**
 * Classify one per-case outcome into a masked report row. An outcome is:
 *   { caseId, model, rescueModel, promptLeak: boolean, result: RefineResult | null }
 * The prompt_leak pre-check carries no RefineResult; every other fallback maps
 * its FIRST rejection reason for the row label (full guard counts ride alongside).
 *
 * Model label (M3.4d): a rescue-adopted row shows the rescue model; a both-tiers
 * fallback shows the `primary→rescue` escalation; everything else shows primary.
 */
function classifyRow(outcome) {
  const { caseId, model, rescueModel } = outcome
  if (outcome.promptLeak) {
    return {
      caseId,
      model,
      status: 'fallback',
      reason: 'prompt_leak',
      tier: null,
      isFallback: true,
      structural: {},
      guardSummary: 'prompt_leak',
    }
  }

  const result = outcome.result ?? {}
  if (result.used === 'refined') {
    const tier = result.tier ?? 'primary'
    return {
      caseId,
      model: tier === 'rescue' ? rescueModel ?? model : model,
      status: 'refined',
      reason: null,
      tier,
      isFallback: false,
      structural: {},
      guardSummary: 'struct=0 leak=0 lint=0',
    }
  }

  const reasons = Array.isArray(result.rejectionReasons) ? result.rejectionReasons : []
  const mapped = reasons.map((r) => REFINE_REASON_MAP[r] ?? r)
  const reason = mapped[0] ?? 'unknown'
  const structural = groupStructuralReasons(result.structuralIssues)
  const leak = Array.isArray(result.leakHits) ? result.leakHits.length : 0
  const lint = countErrors(result.lintIssues)
  const label = rescueAttempted(result) && rescueModel ? `${model}→${rescueModel}` : model
  return {
    caseId,
    model: label,
    status: 'fallback',
    reason,
    tier: null,
    isFallback: true,
    structural,
    guardSummary: `${formatStructCount(structural)} leak=${leak} lint=${lint}`,
  }
}

export function summarizeRefineSmoke(outcomes) {
  const list = Array.isArray(outcomes) ? outcomes : []
  const rows = list.map(classifyRow)

  const total = rows.length
  const accepted = rows.filter((r) => !r.isFallback).length
  const rejected = total - accepted

  const byReason = {}
  const structuralBreakdown = {}
  // M3.4d adoption tier: primary-accepted / rescue-accepted / fell back to deterministic.
  const byTier = { primary: 0, rescue: 0, deterministic: 0 }
  for (const row of rows) {
    if (row.isFallback) {
      byTier.deterministic += 1
      if (row.reason) byReason[row.reason] = (byReason[row.reason] ?? 0) + 1
    } else if (row.tier === 'rescue') {
      byTier.rescue += 1
    } else {
      byTier.primary += 1
    }
    for (const [reason, count] of Object.entries(row.structural ?? {})) {
      structuralBreakdown[reason] = (structuralBreakdown[reason] ?? 0) + count
    }
  }

  return {
    total,
    accepted,
    rejected,
    fallback: rejected,
    acceptRate: total ? accepted / total : 0,
    fallbackRate: total ? rejected / total : 0,
    byReason,
    byTier,
    structuralBreakdown,
    rows,
  }
}

// ---------------------------------------------------------------------------
// formatRefineSmokeReport — masked operator output
// ---------------------------------------------------------------------------

const REFINE_REASON_LABELS = {
  disabled: 'AI_AGENT_REFINE_LLM_ENABLED 未開啟',
  runtime_not_real: 'AI_AGENT_REFINE_LLM_RUNTIME 非 real',
  missing_key: '缺 ANTHROPIC_API_KEY',
  factory_unavailable: '@anthropic-ai/sdk 未安裝或 adapter factory 不可用（需 tsx 執行）',
}

function pct(x) {
  return `${Math.round((Number(x) || 0) * 100)}%`
}

/** M3.4d adoption-tier rollup: how many the primary (Haiku) won, how many the
 * rescue (Sonnet) saved, how many still fell back. Masked — pure counts. */
function formatByTier(byTier) {
  const t = byTier ?? {}
  return [
    '採用層分佈：',
    `  · primary：${t.primary ?? 0}`,
    `  · rescue：${t.rescue ?? 0}`,
    `  · 仍 fallback（deterministic）：${t.deterministic ?? 0}`,
  ]
}

function formatByReason(byReason) {
  const entries = Object.entries(byReason ?? {})
  if (entries.length === 0) return ['  · （無 fallback）']
  return entries.map(([reason, count]) => `  · ${reason}：${count}`)
}

/** Masked aggregate of the structural sub-reasons that caused structural_diff
 * fallbacks across every case — the at-a-glance "which facts moved" rollup. Each
 * key is a fact category only, so this is safe to print. Empty → omitted. */
function formatStructuralBreakdown(structuralBreakdown) {
  const entries = Object.entries(structuralBreakdown ?? {})
  if (entries.length === 0) return []
  return [
    'structural 子原因（全案彙總）：',
    ...entries.map(([reason, count]) => `  · ${reason}：${count}`),
  ]
}

function formatRow(row) {
  const status = row.status === 'refined' ? '✅ refined' : `↩️ fallback（${row.reason}）`
  return `  · ${row.caseId} [${row.model}] ${status}｜${row.guardSummary}`
}

/**
 * Format a refine smoke report into a Traditional Chinese operator summary.
 * Reads ONLY masked fields — rates, by-reason counts, per-case guard COUNTS —
 * never a draft body, a prompt, a token, cost, or PII.
 */
export function formatRefineSmokeReport(report) {
  if (report?.status === 'skipped') {
    const label = REFINE_REASON_LABELS[report.reason] ?? report.reason
    return ['Refine Smoke · 已略過', `（${label}，未呼叫 LLM）`].join('\n')
  }

  if (report?.status === 'client_not_wired') {
    const label = REFINE_REASON_LABELS[report.reason] ?? report.reason
    return ['Refine Smoke · 未接上', `原因：${report.reason}（${label}）`].join('\n')
  }

  if (report?.status === 'error') {
    return ['Refine Smoke · 失敗', '錯誤碼：wiring_error（runtime 組裝失敗，細節已遮蔽）'].join('\n')
  }

  const s = report?.summary ?? {}
  const lines = [
    'Refine Smoke · 完成（offline guard 統計；草稿／prompt 全文不顯示）',
    `總數：${s.total ?? 0} · 採用 refined：${s.accepted ?? 0} · 退回 deterministic：${s.rejected ?? 0}`,
    `採用率：${pct(s.acceptRate)} · fallback 率：${pct(s.fallbackRate)}`,
    ...formatByTier(s.byTier),
    'fallback 原因分佈：',
    ...formatByReason(s.byReason),
    ...formatStructuralBreakdown(s.structuralBreakdown),
    '— per-case（masked guard 計數）—',
    ...(Array.isArray(s.rows) ? s.rows.map(formatRow) : []),
  ]
  return lines.join('\n')
}
