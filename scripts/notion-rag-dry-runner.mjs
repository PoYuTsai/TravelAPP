#!/usr/bin/env node
/**
 * notion-rag-dry-runner.mjs
 *
 * Runtime bridge entry for the offline `notion-rag-dry-run` operator command.
 *
 * `scripts/agent-command.mjs` is plain Node ESM and cannot runtime-import the
 * TypeScript traverse (`src/lib/line-agent/notion/notion-rag-traverse.ts`) or a
 * real `@notionhq/client`. The command resolves its runner through a pluggable
 * seam: when enabled and nothing is injected, it calls a runtime loader that
 * returns `{ runDryRun, client }`. This module IS that loader.
 *
 * This cut is deliberately MOCK-FIRST: it wires NOTHING real. It returns a
 * not-wired runtime so the command surfaces a safe `client_not_wired` error and
 * never touches a real Notion API, token, or the live path. A future knife
 * replaces the body to build the real client + bridge the traverse (e.g. via a
 * tsx/dist step); the command layer's resolution order does NOT change.
 *
 * Contract:
 *   loadNotionRagDryRunRuntime({ env }) → Promise<{ runDryRun, client }>
 *     runDryRun: (env, client) => Promise<NotionRagTraverseReport> | null
 *     client:    NotionRagClient | null
 *   A missing runDryRun OR client ⇒ the command projects `client_not_wired`.
 *   Any throw here is caught by the command and collapsed to `client_error`
 *   (so this module may stay simple — it owns no leak guard of its own).
 */

/**
 * Mock-first runtime: not wired. Returns nulls so the command stays in its safe
 * `client_not_wired` projection until the real wiring lands.
 */
export async function loadNotionRagDryRunRuntime() {
  return { runDryRun: null, client: null }
}
