import type { LineAssistantConfig } from './types'

function trimTrailingSlash(value: string | undefined): string | null {
  if (!value) return null
  return value.replace(/\/+$/, '')
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

function parseCustomerDatabaseIds(rawValue: string | undefined): Record<string, string> {
  if (!rawValue?.trim()) {
    return {}
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value === 'string' && value.trim()) {
        acc[key] = value
      }
      return acc
    }, {})
  } catch {
    throw new Error('Invalid NOTION_CUSTOMER_DATABASE_IDS_JSON value')
  }
}

export function getLineAssistantConfig(env: NodeJS.ProcessEnv = process.env): LineAssistantConfig {
  const kvRestApiUrl = env.KV_REST_API_URL?.trim() || null
  const kvRestApiToken = env.KV_REST_API_TOKEN?.trim() || null

  return {
    siteUrl: trimTrailingSlash(env.NEXT_PUBLIC_SITE_URL),
    line: {
      channelAccessToken: requireEnv(env, 'LINE_CHANNEL_ACCESS_TOKEN'),
      channelSecret: requireEnv(env, 'LINE_CHANNEL_SECRET'),
    },
    telegram: {
      botToken: requireEnv(env, 'TELEGRAM_BOT_TOKEN'),
      groupId: requireEnv(env, 'TELEGRAM_GROUP_ID'),
      webhookSecret: env.TELEGRAM_WEBHOOK_SECRET?.trim() || null,
    },
    anthropic: {
      apiKey: env.ANTHROPIC_API_KEY?.trim() || null,
    },
    openai: {
      apiKey: env.OPENAI_API_KEY?.trim() || null,
    },
    notion: {
      token: env.NOTION_TOKEN?.trim() || null,
      customerDatabaseIds: parseCustomerDatabaseIds(env.NOTION_CUSTOMER_DATABASE_IDS_JSON),
    },
    storage: {
      mode: kvRestApiUrl && kvRestApiToken ? 'kv' : 'memory',
      kvRestApiUrl,
      kvRestApiToken,
    },
    cron: {
      secret: env.LINE_ASSISTANT_CRON_SECRET?.trim() || null,
    },
  }
}
