import { describe, expect, it } from 'vitest'
import { getLineAssistantConfig } from '@/lib/line-assistant/config'

describe('getLineAssistantConfig', () => {
  it('throws when required env vars are missing', () => {
    expect(() => getLineAssistantConfig({} as NodeJS.ProcessEnv)).toThrow(
      /LINE_CHANNEL_ACCESS_TOKEN/
    )
  })

  it('parses the configured environment values', () => {
    const config = getLineAssistantConfig({
      LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
      LINE_CHANNEL_SECRET: 'line-secret',
      TELEGRAM_BOT_TOKEN: 'tg-token',
      TELEGRAM_GROUP_ID: '-1001234567890',
      TELEGRAM_WEBHOOK_SECRET: 'tg-secret',
      ANTHROPIC_API_KEY: 'anthropic-key',
      NOTION_TOKEN: 'notion-token',
      KV_REST_API_URL: 'https://example-kv.test',
      KV_REST_API_TOKEN: 'kv-token',
      LINE_ASSISTANT_CRON_SECRET: 'cron-secret',
      NEXT_PUBLIC_SITE_URL: 'https://chiangway-travel.com/',
      NOTION_CUSTOMER_DATABASE_IDS_JSON: '{"2025":"db-2025","2026":"db-2026"}',
    } as NodeJS.ProcessEnv)

    expect(config.line.channelAccessToken).toBe('line-token')
    expect(config.telegram.groupId).toBe('-1001234567890')
    expect(config.notion.customerDatabaseIds).toEqual({
      '2025': 'db-2025',
      '2026': 'db-2026',
    })
    expect(config.siteUrl).toBe('https://chiangway-travel.com')
  })

  it('throws when notion customer database ids are invalid json', () => {
    expect(() =>
      getLineAssistantConfig({
        LINE_CHANNEL_ACCESS_TOKEN: 'line-token',
        LINE_CHANNEL_SECRET: 'line-secret',
        TELEGRAM_BOT_TOKEN: 'tg-token',
        TELEGRAM_GROUP_ID: '-1001234567890',
        NOTION_CUSTOMER_DATABASE_IDS_JSON: '{bad json}',
      } as NodeJS.ProcessEnv)
    ).toThrow(/NOTION_CUSTOMER_DATABASE_IDS_JSON/)
  })
})
