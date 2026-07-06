import { appendEvent } from './events.mjs'

const DISCORD_FETCH_LIMIT = 100
const DEFAULT_CONFIRM_THRESHOLD = 100
const MAX_CLEAR_COUNT = 1000
const BULK_DELETE_WINDOW_MS = 14 * 24 * 60 * 60 * 1000

export async function clearDiscordChannelMessages(options = {}) {
  const count = normalizeCount(options.count)
  const confirmThreshold = options.confirmThreshold ?? DEFAULT_CONFIRM_THRESHOLD

  if (count > confirmThreshold && options.confirm !== true) {
    return {
      action: 'chat-clear',
      channelId: options.channel?.id,
      requested: count,
      deleted: 0,
      skippedPinned: 0,
      skippedTooOld: 0,
      dryRun: true,
      confirmationRequired: true,
      nextCommand: `/chat-clear count:${count} confirm:true`,
    }
  }

  if (!options.channel?.messages?.fetch) {
    return {
      action: 'chat-clear',
      channelId: options.channel?.id,
      requested: count,
      deleted: 0,
      skippedPinned: 0,
      skippedTooOld: 0,
      dryRun: false,
      allowed: false,
      reason: 'Discord channel is not available to the cleaner',
    }
  }

  const now = resolveNow(options.now)
  let remaining = count
  let deleted = 0
  let skippedPinned = 0
  let skippedTooOld = 0

  while (remaining > 0) {
    const limit = Math.min(remaining, DISCORD_FETCH_LIMIT)
    const fetched = collectionToArray(await options.channel.messages.fetch({ limit }))
    if (fetched.length === 0) break

    remaining -= fetched.length
    const candidates = []
    for (const item of fetched) {
      if (item.pinned && options.includePinned !== true) {
        skippedPinned += 1
      } else if (isTooOldForBulkDelete(item, now)) {
        skippedTooOld += 1
      } else {
        candidates.push(item)
      }
    }

    deleted += await deleteCandidates(options.channel, candidates)
    if (fetched.length < limit) break
  }

  const result = {
    action: 'chat-clear',
    channelId: options.channel.id,
    requested: count,
    deleted,
    skippedPinned,
    skippedTooOld,
    dryRun: false,
  }

  await appendEvent(
    {
      type: 'chat_clear',
      actor: options.actorId,
      channelId: options.channel.id,
      requested: count,
      deleted,
      skippedPinned,
      skippedTooOld,
    },
    { stateDir: options.stateDir, now: () => now.toISOString() }
  )

  return result
}

function normalizeCount(value) {
  const count = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(count) || count < 1) return 100
  return Math.min(count, MAX_CLEAR_COUNT)
}

function resolveNow(now) {
  const value = typeof now === 'function' ? now() : new Date()
  return value instanceof Date ? value : new Date(value)
}

function collectionToArray(collection) {
  if (!collection) return []
  if (Array.isArray(collection)) return collection
  if (typeof collection.values === 'function') return Array.from(collection.values())
  return Array.from(collection)
}

function isTooOldForBulkDelete(message, now) {
  const createdTimestamp = Number(message.createdTimestamp)
  if (!Number.isFinite(createdTimestamp)) return true
  return createdTimestamp < now.getTime() - BULK_DELETE_WINDOW_MS
}

async function deleteCandidates(channel, candidates) {
  if (candidates.length === 0) return 0
  if (candidates.length === 1) {
    await candidates[0].delete()
    return 1
  }

  const deleted = await channel.bulkDelete(candidates, true)
  return collectionToArray(deleted).length
}
