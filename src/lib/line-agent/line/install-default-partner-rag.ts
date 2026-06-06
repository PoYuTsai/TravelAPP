/**
 * install-default-partner-rag.ts — M3.2 runtime installer wiring with the REAL
 * `@notionhq/client` adapter (design 2026-06-06-line-oa-m3-2-partner-rag-
 * surfacing-design.md §6/§7, "Next knife (still gated off)").
 *
 * This is the single COMPOSITION ROOT for the partner-group RAG draft source: the
 * one place the real Notion SDK is imported and constructed. The seam
 * (webhook-runtime), the adapter (notion-rag-client), and the cached source
 * (notion-rag-answer-source) all stay SDK-free and fully injectable; this module
 * supplies the impure edge they document ("the bootstrap that calls the webhook
 * installer").
 *
 * Deliberately OPT-IN and side-effect free at import:
 *  - NOTHING runs at module load. Importing this file constructs no SDK, reads no
 *    env, hits no Notion, and leaves the answer-source seam at its fail-closed
 *    not-wired default. The wiring happens ONLY when a bootstrap explicitly calls
 *    `installDefaultPartnerRagAnswerSource`.
 *  - It flips NO env gate. The dispatcher's per-respond `shouldUsePartnerRagDraft`
 *    gate still governs whether the installed source is ever reached, so even
 *    after install, gate-off ⇒ `base` responder ⇒ zero Notion read.
 *
 * Fail-closed + leak-safe:
 *  - A missing `NOTION_TOKEN` ⇒ the SDK is never constructed, nothing is
 *    installed, and the result carries a fixed code (`missing_notion_token`) —
 *    never the (absent) token.
 *  - An SDK construction failure is swallowed and surfaced as a fixed code
 *    (`notion_client_init_failed`); the raw error (which could echo the token) is
 *    never returned, logged, or installed.
 */

import { Client } from '@notionhq/client'
import {
  createNotionRagClient,
  type NotionLikeSdkClient,
} from '../notion/notion-rag-client'
import { installPartnerRagAnswerSource } from './webhook-runtime'

/**
 * Default cache lifetime for the installed source (§6 cost guard). Within this
 * window the built index is reused, so a burst of partner messages triggers at
 * most one Notion read. Mirrors the value used by the source tests.
 */
export const DEFAULT_PARTNER_RAG_TTL_MS = 10 * 60 * 1000

/** Builds the injected Notion-like SDK from an auth token (tests inject a fake). */
export type NotionSdkClientFactory = (auth: string) => NotionLikeSdkClient

export interface InstallDefaultPartnerRagDeps {
  /** Env to read the token + RAG config from. Defaults to process.env. */
  env?: Record<string, string | undefined>
  /** Cache lifetime in ms (§6 TTL). Defaults to DEFAULT_PARTNER_RAG_TTL_MS. */
  ttlMs?: number
  /**
   * SDK factory seam. Defaults to the real `@notionhq/client` `Client`; tests
   * inject a fake so no real SDK is constructed and no live API is hit.
   */
  createSdkClient?: NotionSdkClientFactory
}

export interface InstallDefaultPartnerRagResult {
  installed: boolean
  /** Fixed sanitized code when not installed — never a token / db id / url. */
  reason?: 'missing_notion_token' | 'notion_client_init_failed'
}

/**
 * The real SDK factory. The v5 `Client` is structurally compatible with our
 * narrow `NotionLikeSdkClient` port (`databases.retrieve` + `dataSources.query`),
 * but its declared types are broader, so we cast through `unknown`. Constructing
 * the client is lazy (no network), so this is safe to build at install time.
 */
const defaultSdkFactory: NotionSdkClientFactory = (auth) =>
  new Client({ auth }) as unknown as NotionLikeSdkClient

/**
 * Opt the runtime INTO the real cached Notion RAG answer source. Reads the token
 * from env, builds the SDK via the (injectable) factory, wraps it in the loader
 * adapter, and installs the cached source through the webhook seam. Fail-closed
 * and leak-safe (see file header). Returns whether the source was installed plus
 * a sanitized reason code when it was not.
 */
export function installDefaultPartnerRagAnswerSource(
  deps: InstallDefaultPartnerRagDeps = {},
): InstallDefaultPartnerRagResult {
  const env = deps.env ?? process.env
  const token = (env.NOTION_TOKEN ?? '').trim()
  if (token === '') {
    // No token ⇒ never construct the SDK, never hit Notion, never install. The
    // seam stays the not-wired throwing default.
    return { installed: false, reason: 'missing_notion_token' }
  }

  const createSdkClient = deps.createSdkClient ?? defaultSdkFactory
  let sdk: NotionLikeSdkClient
  try {
    sdk = createSdkClient(token)
  } catch {
    // Swallow the raw construction error — it may echo the token — and surface a
    // fixed sanitized code. Nothing is installed; the seam stays fail-closed.
    return { installed: false, reason: 'notion_client_init_failed' }
  }

  installPartnerRagAnswerSource({
    client: createNotionRagClient(sdk),
    env,
    ttlMs: deps.ttlMs ?? DEFAULT_PARTNER_RAG_TTL_MS,
  })
  return { installed: true }
}
