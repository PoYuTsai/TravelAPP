import {
  AI_ROOM_SLASH_COMMANDS,
  discordInteractionToMessage,
  shouldHandleInteraction,
} from './discord-commands.mjs'
import {
  buildWebhookConfig,
  deliverDiscordResult,
} from './discord-delivery.mjs'
import { executeDiscordDecision } from './discord-executor.mjs'
import { routeDiscordMessage } from './discord-router.mjs'

export async function handleDiscordMessage(message, env) {
  if (message.author?.bot) return null

  const decision = routeDiscordMessage(
    {
      channelId: message.channelId,
      authorId: message.author?.id,
      content: message.content,
    },
    { privateChannelId: env.privateChannelId }
  )

  const result = await executeDiscordDecision(
    decision,
    executionOptions(env, { discordChannel: message.channel })
  )
  const delivery = await deliverDiscordResult(result, {
    fallbackReply: (content) => message.reply(content),
    fetch: env.fetch,
    ...webhookOptions(env),
  })
  return { ...result, delivery }
}

export async function handleDiscordInteraction(interaction, env) {
  if (!shouldHandleInteraction(interaction)) return null

  const decision = routeDiscordMessage(discordInteractionToMessage(interaction), {
    privateChannelId: env.privateChannelId,
  })

  const result = await executeDiscordDecision(
    decision,
    executionOptions(env, { discordChannel: interaction.channel })
  )
  if (result.shouldReply) {
    await interaction.reply({
      content: result.content,
      ephemeral: result.ephemeral === true,
    })
  }
  return result
}

export async function registerSlashCommands(client, options = {}) {
  const guildId = options.guildId
  if (!guildId) {
    return {
      registered: false,
      reason: 'AI_ROOM_DISCORD_GUILD_ID is not configured',
    }
  }

  await client.application.commands.set(AI_ROOM_SLASH_COMMANDS, guildId)
  return {
    registered: true,
    guildId,
    commandCount: AI_ROOM_SLASH_COMMANDS.length,
  }
}

function executionOptions(env, extra = {}) {
  return {
    stateDir: env.stateDir,
    tmuxMode: env.tmuxMode,
    tmux: env.tmux,
    now: env.now,
    ...extra,
  }
}

function webhookOptions(env) {
  if (env.webhooks || env.identities) {
    return {
      webhooks: env.webhooks,
      identities: env.identities,
    }
  }
  return buildWebhookConfig(process.env)
}
