const OPTION_TYPES = {
  string: 3,
  integer: 4,
  boolean: 5,
}

export const AI_ROOM_SLASH_COMMANDS = Object.freeze([
  {
    name: 'sessions',
    description: 'Show the private AI room tmux session inventory.',
  },
  {
    name: 'focus',
    description: 'Show or switch the shared private-room project focus.',
    options: [
      stringOption('project', 'travel or vibesync', false, ['travel', 'vibesync']),
      booleanOption('confirm', 'Confirm a focus switch.', false),
    ],
  },
  {
    name: 'health',
    description: 'Check active rc session health and legacy dc warnings.',
  },
  {
    name: 'mode',
    description: 'Show or switch private-room autonomy mode.',
    options: [
      stringOption('mode', 'supervised, autopilot_dev, or autopilot_ship', false, [
        'supervised',
        'autopilot_dev',
        'autopilot_ship',
      ]),
      booleanOption('confirm', 'Confirm enabling autopilot_ship.', false),
    ],
  },
  {
    name: 'chat-mode',
    description: 'Show or switch local room chat behavior.',
    options: [
      stringOption('mode', 'balanced, casual, or work', false, [
        'balanced',
        'casual',
        'work',
      ]),
    ],
  },
  {
    name: 'codex',
    description: 'Ask Codex for planning, architecture, review, or perspective.',
    options: [stringOption('prompt', 'Question or request for Codex.', false)],
  },
  {
    name: 'cc',
    description: 'Ask Claude Code to plan or run guarded implementation work.',
    options: [
      stringOption('prompt', 'Task or question for Claude Code.', false),
      booleanOption('confirm', 'Actually dispatch confirmed work to the active rc session.', false),
    ],
  },
  {
    name: 'round',
    description: 'Preview or run /round for the active rc session.',
    options: [booleanOption('confirm', 'Actually send /round to the active rc session.', false)],
  },
  {
    name: 'clear',
    description: 'Preview /clear for the active rc session.',
    options: [
      booleanOption('force', 'Allow clear without a recent round.', false),
      booleanOption('confirm', 'Actually send /clear to the active rc session.', false),
    ],
  },
  {
    name: 'chat-clear',
    description: 'Clear recent messages from the private AI room channel.',
    options: [
      integerOption('count', 'Recent message count to clear.', true),
      booleanOption('confirm', 'Confirm clearing more than 100 messages.', false),
    ],
  },
  {
    name: 'interrupt',
    description: 'Request an interrupt for the active rc session.',
    options: [booleanOption('confirm', 'Confirm interrupt.', false)],
  },
  {
    name: 'rebind',
    description: 'Show the guarded Claude Code rebind plan.',
  },
])

export function shouldHandleInteraction(interaction) {
  return interaction?.isChatInputCommand?.() === true
}

export function discordInteractionToMessage(interaction) {
  return {
    channelId: interaction.channelId,
    authorId: interaction.user?.id,
    content: interactionToContent(interaction),
  }
}

function interactionToContent(interaction) {
  const command = interaction.commandName
  const parts = [`/${command}`]

  if (command === 'focus') {
    pushStringOption(parts, interaction, 'project')
    pushBooleanWord(parts, interaction, 'confirm', 'confirm')
  } else if (command === 'mode') {
    pushStringOption(parts, interaction, 'mode')
    pushBooleanWord(parts, interaction, 'confirm', 'confirm')
  } else if (command === 'chat-mode') {
    pushStringOption(parts, interaction, 'mode')
  } else if (command === 'codex') {
    pushStringOption(parts, interaction, 'prompt')
  } else if (command === 'cc') {
    pushStringOption(parts, interaction, 'prompt')
    pushBooleanWord(parts, interaction, 'confirm', '--confirm')
  } else if (command === 'clear') {
    pushBooleanWord(parts, interaction, 'force', 'force')
    pushBooleanWord(parts, interaction, 'confirm', 'confirm')
  } else if (command === 'chat-clear') {
    pushIntegerOption(parts, interaction, 'count')
    pushBooleanWord(parts, interaction, 'confirm', 'confirm:true')
  } else if (command === 'round') {
    pushBooleanWord(parts, interaction, 'confirm', 'confirm')
  } else if (command === 'interrupt') {
    pushBooleanWord(parts, interaction, 'confirm', 'confirm')
  }

  return parts.join(' ')
}

function stringOption(name, description, required, choices = []) {
  return {
    name,
    description,
    type: OPTION_TYPES.string,
    required,
    ...(choices.length > 0 && {
      choices: choices.map((value) => ({ name: value, value })),
    }),
  }
}

function booleanOption(name, description, required) {
  return {
    name,
    description,
    type: OPTION_TYPES.boolean,
    required,
  }
}

function integerOption(name, description, required) {
  return {
    name,
    description,
    type: OPTION_TYPES.integer,
    required,
    min_value: 1,
    max_value: 1000,
  }
}

function pushStringOption(parts, interaction, name) {
  const value = interaction.options?.getString?.(name)
  if (value) parts.push(value)
}

function pushBooleanWord(parts, interaction, name, word) {
  if (interaction.options?.getBoolean?.(name) === true) {
    parts.push(word)
  }
}

function pushIntegerOption(parts, interaction, name) {
  const value = interaction.options?.getInteger?.(name)
  if (Number.isInteger(value)) parts.push(`${name}:${value}`)
}
