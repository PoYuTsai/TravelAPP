/**
 * Agent configuration loader.
 *
 * Parses and validates environment variables into a strongly-typed AgentConfig
 * object.  Designed to be injectable — pass a plain Record<string, string>
 * (defaults to process.env) so unit tests never need to mutate global env.
 *
 * Throws AgentConfigError (listing ALL missing required vars) if validation
 * fails.  Safe defaults exist ONLY for local-development convenience values
 * (e.g. AGENT_RETENTION_DAYS).  Secrets must always be explicitly set.
 */

import { AgentConfigError } from './errors'
import type { AgentRouteMode } from './types'

// ---------------------------------------------------------------------------
// Config shape
// ---------------------------------------------------------------------------

export interface LineConfig {
  channelSecret: string
  channelAccessToken: string
  partnerGroupId: string
  routeMode: AgentRouteMode
}

export interface DcConfig {
  internalSecret: string
  discordPrivateChannelId: string
  discordBotToken: string
  discordPublicKey: string
}

export interface ModelsConfig {
  anthropicApiKey: string
  openaiApiKey: string
  defaultModel: string
  researchModel: string
  visionModel: string
}

export interface NotionConfig {
  token: string
  team2026DatabaseId: string
}

export interface StorageConfig {
  kvUrl: string
  kvToken: string
  /** How many days raw messages are kept in KV.  Defaults to 90. */
  retentionDays: number
}

export interface AgentConfig {
  line: LineConfig
  dc: DcConfig
  models: ModelsConfig
  notion: NotionConfig
  storage: StorageConfig
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

function require(
  env: Record<string, string | undefined>,
  key: string,
  missing: string[]
): string {
  const value = env[key]
  if (!value || value.trim() === '') {
    missing.push(key)
    return '' // placeholder; caller checks missing array before using
  }
  return value.trim()
}

function optional(
  env: Record<string, string | undefined>,
  key: string,
  defaultValue: string
): string {
  const value = env[key]
  return value && value.trim() !== '' ? value.trim() : defaultValue
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

/**
 * Parse and validate the agent environment into a typed AgentConfig.
 *
 * @param env - An env record to parse.  Defaults to process.env.
 *              Pass a plain object in tests to avoid mutating global env.
 * @throws {AgentConfigError} when one or more required vars are absent.
 */
export function loadAgentConfig(
  env: Record<string, string | undefined> = process.env
): AgentConfig {
  const missing: string[] = []

  // ── LINE ─────────────────────────────────────────────────────────────────
  const channelSecret = require(env, 'LINE_CHANNEL_SECRET', missing)
  const channelAccessToken = require(env, 'LINE_CHANNEL_ACCESS_TOKEN', missing)
  const partnerGroupId = require(env, 'LINE_PARTNER_GROUP_ID', missing)

  // LINE_ROUTE_MODE has a safe local-dev default; it is not a secret.
  const rawRouteMode = optional(env, 'LINE_ROUTE_MODE', 'discord_smoke')
  const routeMode: AgentRouteMode =
    rawRouteMode === 'partner_group' ? 'partner_group' : 'discord_smoke'

  // ── DC / Discord operator bridge ─────────────────────────────────────────
  const internalSecret = require(env, 'AI_AGENT_INTERNAL_SECRET', missing)
  const discordPrivateChannelId = require(env, 'DISCORD_PRIVATE_CHANNEL_ID', missing)
  const discordBotToken = require(env, 'DISCORD_BOT_TOKEN', missing)
  const discordPublicKey = require(env, 'DISCORD_PUBLIC_KEY', missing)

  // ── Models ────────────────────────────────────────────────────────────────
  const anthropicApiKey = require(env, 'ANTHROPIC_API_KEY', missing)
  const openaiApiKey = require(env, 'OPENAI_API_KEY', missing)
  const defaultModel = require(env, 'AI_AGENT_DEFAULT_MODEL', missing)
  const researchModel = require(env, 'AI_AGENT_RESEARCH_MODEL', missing)
  const visionModel = require(env, 'AI_AGENT_VISION_MODEL', missing)

  // ── Notion ────────────────────────────────────────────────────────────────
  const notionToken = require(env, 'NOTION_TOKEN', missing)
  const team2026DatabaseId = require(env, 'NOTION_TEAM_2026_DATABASE_ID', missing)

  // ── Storage ───────────────────────────────────────────────────────────────
  const kvUrl = require(env, 'AGENT_KV_URL', missing)
  const kvToken = require(env, 'AGENT_KV_TOKEN', missing)
  // AGENT_RETENTION_DAYS is a local-dev safe default; not a secret.
  const retentionDays = parseInt(optional(env, 'AGENT_RETENTION_DAYS', '90'), 10)

  // ── Validate all at once ──────────────────────────────────────────────────
  if (missing.length > 0) {
    throw new AgentConfigError(missing)
  }

  return {
    line: {
      channelSecret,
      channelAccessToken,
      partnerGroupId,
      routeMode,
    },
    dc: {
      internalSecret,
      discordPrivateChannelId,
      discordBotToken,
      discordPublicKey,
    },
    models: {
      anthropicApiKey,
      openaiApiKey,
      defaultModel,
      researchModel,
      visionModel,
    },
    notion: {
      token: notionToken,
      team2026DatabaseId,
    },
    storage: {
      kvUrl,
      kvToken,
      retentionDays,
    },
  }
}
