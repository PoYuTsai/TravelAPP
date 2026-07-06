#!/usr/bin/env node

import { loadLocalEnv } from './env-loader.mjs'
import {
  handleDiscordInteraction,
  handleDiscordMessage,
  registerSlashCommands,
} from './discord-live-handlers.mjs'

async function main() {
  await loadLocalEnv()

  const token = process.env.AI_ROOM_DISCORD_TOKEN
  const privateChannelId = process.env.AI_ROOM_PRIVATE_CHANNEL_ID

  if (!token || !privateChannelId) {
    console.error(
      'AI_ROOM_DISCORD_TOKEN and AI_ROOM_PRIVATE_CHANNEL_ID are required to start the AI room Discord bot.'
    )
    process.exitCode = 1
    return
  }

  const { Client, GatewayIntentBits } = await import('discord.js')
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  })

  client.once('ready', async () => {
    const result = await registerSlashCommands(client, {
      guildId: process.env.AI_ROOM_DISCORD_GUILD_ID,
    })
    if (result.registered) {
      console.log(
        `AI room slash commands registered in guild ${result.guildId} (${result.commandCount}).`
      )
    } else {
      console.log(`AI room slash commands not registered: ${result.reason}`)
    }
  })

  client.on('messageCreate', async (message) => {
    await handleDiscordMessage(message, {
      privateChannelId,
      stateDir: process.env.AI_ROOM_STATE_DIR,
      tmuxMode: process.env.AI_ROOM_TMUX_MODE,
    })
  })

  client.on('interactionCreate', async (interaction) => {
    await handleDiscordInteraction(interaction, {
      privateChannelId,
      stateDir: process.env.AI_ROOM_STATE_DIR,
      tmuxMode: process.env.AI_ROOM_TMUX_MODE,
    })
  })

  await client.login(token)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
