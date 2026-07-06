import { describe, expect, it } from 'vitest'

import { buildDiscordInviteUrl, formatDiscordInviteSetup } from '../invite.mjs'

describe('buildDiscordInviteUrl', () => {
  it('builds an invite URL with bot and slash-command scopes', () => {
    expect(buildDiscordInviteUrl({ clientId: '1234567890' })).toBe(
      'https://discord.com/api/oauth2/authorize?client_id=1234567890&permissions=76800&scope=bot+applications.commands'
    )
  })

  it('rejects missing or non-numeric client ids', () => {
    expect(() => buildDiscordInviteUrl({ clientId: '' })).toThrow(/required/)
    expect(() => buildDiscordInviteUrl({ clientId: 'abc' })).toThrow(/numeric/)
  })
})

describe('formatDiscordInviteSetup', () => {
  it('prints setup guidance when the client id is missing', () => {
    expect(formatDiscordInviteSetup()).toContain('missing AI_ROOM_DISCORD_CLIENT_ID')
    expect(formatDiscordInviteSetup()).toContain('Message')
  })

  it('prints the invite URL when the client id is present', () => {
    const output = formatDiscordInviteSetup({ clientId: '1234567890' })

    expect(output).toContain('Discord bot invite URL')
    expect(output).toContain('client_id=1234567890')
  })
})
