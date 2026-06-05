const DEFAULT_PERMISSION_BITS = 76800
const DEFAULT_SCOPES = Object.freeze(['bot', 'applications.commands'])

export function buildDiscordInviteUrl(options = {}) {
  const clientId = normalizeClientId(options.clientId)
  const permissions = options.permissions ?? DEFAULT_PERMISSION_BITS
  const scopes = options.scopes ?? DEFAULT_SCOPES

  const params = new URLSearchParams({
    client_id: clientId,
    permissions: String(permissions),
    scope: scopes.join(' '),
  })

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`
}

export function formatDiscordInviteSetup(options = {}) {
  if (!options.clientId) {
    return [
      '[Room/invite] missing AI_ROOM_DISCORD_CLIENT_ID',
      'Create or open the Discord application, copy its Application ID, then set AI_ROOM_DISCORD_CLIENT_ID in .env.local.',
      'Required bot permissions: View Channel, Send Messages, Read Message History, Manage Messages.',
      'Required scopes: bot, applications.commands.',
    ].join('\n')
  }

  return [
    '[Room/invite] Discord bot invite URL',
    buildDiscordInviteUrl({ clientId: options.clientId }),
    'After inviting the bot, enable Message Content Intent in the Discord Developer Portal so @cc and @codex mention routing can read ordinary messages.',
  ].join('\n')
}

function normalizeClientId(clientId) {
  const value = String(clientId ?? '').trim()
  if (!value) {
    throw new Error('AI_ROOM_DISCORD_CLIENT_ID is required to build a Discord invite URL.')
  }
  if (!/^\d+$/.test(value)) {
    throw new Error('AI_ROOM_DISCORD_CLIENT_ID must be the numeric Discord application ID.')
  }
  return value
}
