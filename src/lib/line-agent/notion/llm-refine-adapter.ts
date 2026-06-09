/**
 * llm-refine-adapter.ts
 *
 * M3.4c — the REAL LLM adapter that slots into M3.4b's `RefineDraftSource` seam.
 * The harness (`refineCustomerItineraryDraft`) and its three deterministic guards
 * are untouched: this module only produces a candidate; the guards still decide
 * whether it is adopted. PURE construction + an injectable `callModel`; the only
 * non-pure default dynamic-imports `@anthropic-ai/sdk`.
 *
 * Safety design (see docs/plans/2026-06-09-m3.4c-llm-refine-real-adapter-design.md):
 *   - Prompt carries ONLY the deterministic draft string. `buildRefinePrompt`
 *     takes no structured object, so operatorNotes / retrievalApplications /
 *     provenance / themeTag / constraints can never reach the model.
 *   - An input forbidden-terms tripwire (`scanRefinePromptLeak`) runs before the
 *     model is called; a hit throws `RefinePromptLeakError` (sanitized, no draft
 *     content) so a dirty prompt is never sent. The smoke runner also pre-checks
 *     it so `prompt_leak` is a first-class report reason.
 *   - The model default is a single centralised constant, overridable by param
 *     or env.
 */

import type { RefineDraftRequest, RefineDraftSource } from './customer-itinerary-refine'
import { scanCustomerForbiddenTerms } from './customer-facing-forbidden-terms'

// ---------------------------------------------------------------------------
// Model selection (correction 5: centralised default, configurable)
// ---------------------------------------------------------------------------

/** Single source of truth for the refine model. Cheap + fast; the guards make
 * model capability non-safety-critical, so the smoke can measure whether Haiku
 * stays inside the freeze before any escalation. */
export const REFINE_MODEL_DEFAULT = 'claude-haiku-4-5'

/** Resolve order: explicit `model` > env `AI_AGENT_REFINE_LLM_MODEL` > default. */
export function resolveRefineModel(opts?: {
  model?: string
  env?: Record<string, string | undefined>
}): string {
  const explicit = opts?.model?.trim()
  if (explicit) return explicit
  const fromEnv = opts?.env?.AI_AGENT_REFINE_LLM_MODEL?.trim()
  if (fromEnv) return fromEnv
  return REFINE_MODEL_DEFAULT
}

// ---------------------------------------------------------------------------
// Prompt builder (correction 3: only the draft string can enter the prompt)
// ---------------------------------------------------------------------------

export interface RefinePrompt {
  system: string
  user: string
}

const REFINE_SYSTEM_INSTRUCTION = [
  '你是旅遊客服文案潤飾器。下面是一份要給客人看的行程草稿。',
  '你只能暖化「整份行程最上方的標題行（< > 開頭那一行）」與「第一個 Day 之前的開場白／前言」與「結尾收尾結語」的措辭語氣。',
  '以下事實必須逐字凍結，不得新增、刪除、改寫、調換順序，連標點與空白都不能動：',
  '日期行、人數行、每個 Day 的數字與順序、每日日期標籤、每一個「Day X｜…」標題整行、每一條活動行、午餐與晚餐行、住宿行。',
  '特別注意：每一行「Day X｜…」標題（含 X 後面的全部文字、標點與空白）都必須與原文逐字一字不差，禁止改寫景點名、調整標點或增減空白。',
  '最後一天若為早上送機，不得出現午餐／晚餐／住宿。',
  '只回完整草稿本身：不要任何前綴、後綴、說明、code fence 或標記。',
].join('\n')

/**
 * Build the refine prompt. Deliberately takes ONLY the draft string — there is no
 * structured parameter, so internal fields (operatorNotes, retrievalApplications,
 * provenance, themeTag, constraints) are structurally unable to reach the model.
 */
export function buildRefinePrompt(deterministicDraft: string): RefinePrompt {
  return { system: REFINE_SYSTEM_INSTRUCTION, user: deterministicDraft }
}

// ---------------------------------------------------------------------------
// Input tripwire (correction 2: shared forbidden-terms list, distinct reason)
// ---------------------------------------------------------------------------

/** Scan the about-to-be-sent prompt for customer-facing forbidden terms. A hit
 * means the deterministic draft itself is dirty (should not happen). Shares the
 * single forbidden-terms source of truth with the output leak guard. */
export function scanRefinePromptLeak(deterministicDraft: string): string[] {
  const { system, user } = buildRefinePrompt(deterministicDraft)
  return scanCustomerForbiddenTerms(`${system}\n${user}`)
}

/** Sanitized: carries no draft content, so a leaked prompt can't ride the error. */
export class RefinePromptLeakError extends Error {
  constructor() {
    super('Refine prompt leak guard tripped')
    this.name = 'RefinePromptLeakError'
  }
}

// ---------------------------------------------------------------------------
// Source factory
// ---------------------------------------------------------------------------

export interface RefineModelCall {
  system: string
  user: string
  model: string
}

export interface AnthropicRefineDeps {
  apiKey: string
  /** Defaults to resolveRefineModel(). */
  model?: string
  env?: Record<string, string | undefined>
  /**
   * The actual model call. REQUIRED and SDK-free at this layer: mirroring M3.4a,
   * the real `@anthropic-ai/sdk` construction lives in the `.mjs` loader factory,
   * not in this TS lib. Offline tests inject a fake; the loader injects a real one
   * that dynamic-imports the SDK. `apiKey` is carried for the loader's factory.
   */
  callModel: (req: RefineModelCall) => Promise<string>
}

export function createAnthropicRefineSource(deps: AnthropicRefineDeps): RefineDraftSource {
  const model = resolveRefineModel({ model: deps.model, env: deps.env })
  const { callModel } = deps

  return async (req: RefineDraftRequest): Promise<string> => {
    const { deterministicDraft } = req
    // Input tripwire BEFORE any model call — a dirty prompt is never sent.
    if (scanRefinePromptLeak(deterministicDraft).length > 0) {
      throw new RefinePromptLeakError()
    }
    const { system, user } = buildRefinePrompt(deterministicDraft)
    return callModel({ system, user, model })
  }
}
