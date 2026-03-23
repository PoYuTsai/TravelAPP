import { randomUUID, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { handleTelegramAction } from '@/lib/line-assistant/actions/handle-telegram-action'
import { getLineAssistantConfig } from '@/lib/line-assistant/config'
import { getLineAssistantRuntime } from '@/lib/line-assistant/runtime'
import { buildIdempotencyKey } from '@/lib/line-assistant/storage/idempotency-store'
import type { Conversation, TelegramAction, TelegramActionType } from '@/lib/line-assistant/types'
import { apiLogger } from '@/lib/logger'

const telegramCallbackLogger = apiLogger.child('telegram-callback')
const MAX_TELEGRAM_PHOTO_BYTES = 10 * 1024 * 1024

function isValidSecret(provided: string | null, expected: string | null): boolean {
  if (!provided || !expected || provided.length !== expected.length) {
    return false
  }

  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  } catch {
    return false
  }
}

async function parseTelegramAction(payload: unknown): Promise<TelegramAction> {
  const callbackQuery =
    payload &&
    typeof payload === 'object' &&
    'callback_query' in payload &&
    payload.callback_query &&
    typeof payload.callback_query === 'object'
      ? (payload.callback_query as Record<string, unknown>)
      : null

  if (!callbackQuery) {
    throw new Error('Missing callback_query')
  }

  const rawData = callbackQuery.data
  if (typeof rawData !== 'string' || !rawData.trim()) {
    throw new Error('Missing callback_query.data')
  }

  if (rawData.startsWith('la:')) {
    const token = rawData.slice(3)
    if (!token) {
      throw new Error('Missing callback token')
    }

    const storedAction = await getLineAssistantRuntime().telegramActionStore.get(token)
    if (!storedAction) {
      throw new Error('Unknown callback token')
    }

    const message =
      callbackQuery.message && typeof callbackQuery.message === 'object'
        ? (callbackQuery.message as Record<string, unknown>)
        : null
    const from =
      callbackQuery.from && typeof callbackQuery.from === 'object'
        ? (callbackQuery.from as Record<string, unknown>)
        : null

    return {
      ...storedAction.action,
      telegramUserId:
        typeof from?.id === 'number' ? String(from.id) : storedAction.action.telegramUserId,
      telegramMessageId:
        typeof message?.message_id === 'number'
          ? String(message.message_id)
          : storedAction.action.telegramMessageId,
      tgTopicId:
        typeof message?.message_thread_id === 'number'
          ? String(message.message_thread_id)
          : storedAction.action.tgTopicId,
      receivedAt: new Date().toISOString(),
    }
  }

  let parsedData: Record<string, unknown>
  try {
    parsedData = JSON.parse(rawData) as Record<string, unknown>
  } catch {
    throw new Error('Invalid callback_query.data JSON')
  }

  const type = parsedData.type
  const actionId = parsedData.actionId
  const conversationId = parsedData.conversationId
  const draftId = parsedData.draftId
  const lineUserId = parsedData.lineUserId
  const editedText = parsedData.editedText
  const message =
    callbackQuery.message && typeof callbackQuery.message === 'object'
      ? (callbackQuery.message as Record<string, unknown>)
      : null
  const from =
    callbackQuery.from && typeof callbackQuery.from === 'object'
      ? (callbackQuery.from as Record<string, unknown>)
      : null

  if (
    (type !== 'send' && type !== 'edit_then_send' && type !== 'dismiss') ||
    typeof actionId !== 'string' ||
    typeof conversationId !== 'string' ||
    typeof draftId !== 'string' ||
    typeof lineUserId !== 'string'
  ) {
    throw new Error('Invalid telegram action payload')
  }

  return {
    actionId,
    type: type as TelegramActionType,
    conversationId,
    draftId,
    lineUserId,
    receivedAt: new Date().toISOString(),
    editedText: typeof editedText === 'string' ? editedText : undefined,
    telegramUserId: typeof from?.id === 'number' ? String(from.id) : undefined,
    telegramMessageId:
      typeof message?.message_id === 'number' ? String(message.message_id) : undefined,
    tgTopicId:
      typeof message?.message_thread_id === 'number'
        ? String(message.message_thread_id)
        : undefined,
  }
}

function parseTelegramPhotoMessage(payload: unknown): {
  messageId: string
  chatId: string
  topicId?: string
  telegramUserId?: string
  caption?: string
  fileId: string
  fileUniqueId?: string
  fileSize: number | null
  receivedAt: string
} | null {
  const message =
    payload &&
    typeof payload === 'object' &&
    'message' in payload &&
    payload.message &&
    typeof payload.message === 'object'
      ? (payload.message as Record<string, unknown>)
      : null

  if (!message || !Array.isArray(message.photo) || message.photo.length === 0) {
    return null
  }

  const bestPhoto = [...message.photo]
    .filter((photo): photo is Record<string, unknown> => photo && typeof photo === 'object')
    .sort((left, right) => {
      const leftSize = typeof left.file_size === 'number' ? left.file_size : 0
      const rightSize = typeof right.file_size === 'number' ? right.file_size : 0
      return rightSize - leftSize
    })[0]

  if (!bestPhoto || typeof bestPhoto.file_id !== 'string') {
    throw new Error('Missing telegram photo file id')
  }

  const chat =
    message.chat && typeof message.chat === 'object'
      ? (message.chat as Record<string, unknown>)
      : null
  const from =
    message.from && typeof message.from === 'object'
      ? (message.from as Record<string, unknown>)
      : null

  return {
    messageId: typeof message.message_id === 'number' ? String(message.message_id) : randomUUID(),
    chatId: chat && typeof chat.id === 'number' ? String(chat.id) : 'unknown',
    topicId:
      typeof message.message_thread_id === 'number'
        ? String(message.message_thread_id)
        : undefined,
    telegramUserId: from && typeof from.id === 'number' ? String(from.id) : undefined,
    caption: typeof message.caption === 'string' ? message.caption : undefined,
    fileId: bestPhoto.file_id,
    fileUniqueId:
      typeof bestPhoto.file_unique_id === 'string' ? bestPhoto.file_unique_id : undefined,
    fileSize: typeof bestPhoto.file_size === 'number' ? bestPhoto.file_size : null,
    receivedAt:
      typeof message.date === 'number'
        ? new Date(message.date * 1000).toISOString()
        : new Date().toISOString(),
  }
}

function getCallbackQueryId(payload: unknown): string | null {
  const callbackQuery =
    payload &&
    typeof payload === 'object' &&
    'callback_query' in payload &&
    payload.callback_query &&
    typeof payload.callback_query === 'object'
      ? (payload.callback_query as Record<string, unknown>)
      : null

  return typeof callbackQuery?.id === 'string' && callbackQuery.id.trim()
    ? callbackQuery.id
    : null
}

function buildAcknowledgementText(status: 'sent' | 'dismissed' | 'duplicate'): string {
  if (status === 'dismissed') {
    return 'Draft dismissed'
  }

  if (status === 'duplicate') {
    return 'Already processed'
  }

  return 'LINE reply sent'
}

function listMediaTargetConversations(conversations: Conversation[]): Conversation[] {
  return [...conversations]
    .filter((conversation) => conversation.status !== 'archived' && conversation.status !== 'deleted')
    .sort((left, right) => Date.parse(right.lastActivityAt) - Date.parse(left.lastActivityAt))
    .slice(0, 6)
}

async function handleTelegramPhotoMessage(payload: unknown): Promise<{
  status: 'photo_prompted' | 'photo_ignored'
  candidateCount: number
}> {
  const photoMessage = parseTelegramPhotoMessage(payload)
  if (!photoMessage) {
    return {
      status: 'photo_ignored',
      candidateCount: 0,
    }
  }

  if (photoMessage.fileSize && photoMessage.fileSize > MAX_TELEGRAM_PHOTO_BYTES) {
    throw new Error('Telegram photo exceeds maximum allowed size')
  }

  const runtime = getLineAssistantRuntime()
  const messageKey = buildIdempotencyKey(
    'telegram-photo',
    `${photoMessage.chatId}:${photoMessage.messageId}`
  )
  const claimed = await runtime.idempotencyStore.claim(messageKey, 86400)

  if (!claimed) {
    return {
      status: 'photo_ignored',
      candidateCount: 0,
    }
  }

  const mediaToken = randomUUID().replace(/-/g, '').slice(0, 24)
  await runtime.telegramMediaStore.upsert({
    token: mediaToken,
    telegramFileId: photoMessage.fileId,
    telegramFileUniqueId: photoMessage.fileUniqueId,
    contentType: 'image/jpeg',
    fileSize: photoMessage.fileSize,
    caption: photoMessage.caption,
    createdAt: photoMessage.receivedAt,
  })

  const candidates = listMediaTargetConversations(await runtime.conversationStore.list())

  if (candidates.length === 0) {
    if (photoMessage.topicId) {
      await runtime.telegramClient.sendTopicSummary(photoMessage.topicId, '目前沒有可發送的客人。')
    }

    return {
      status: 'photo_ignored',
      candidateCount: 0,
    }
  }

  const buttons: Array<{ text: string; callbackData: string }> = []

  for (const conversation of candidates) {
    const token = randomUUID().replace(/-/g, '').slice(0, 24)
    await runtime.telegramActionStore.upsert({
      token,
      action: {
        actionId: `media:${mediaToken}:${conversation.lineUserId}`,
        type: 'send_image',
        conversationId: conversation.id,
        lineUserId: conversation.lineUserId,
        mediaToken,
        receivedAt: photoMessage.receivedAt,
        telegramUserId: photoMessage.telegramUserId,
        tgTopicId: photoMessage.topicId,
      },
      createdAt: photoMessage.receivedAt,
    })

    buttons.push({
      text: conversation.customerName,
      callbackData: `la:${token}`,
    })
  }

  if (photoMessage.topicId) {
    await runtime.telegramClient.sendTopicActionPrompt(
      photoMessage.topicId,
      '📷 收到照片，要發給誰？',
      buttons
    )
  }

  return {
    status: 'photo_prompted',
    candidateCount: candidates.length,
  }
}

export async function POST(request: Request) {
  let config

  try {
    config = getLineAssistantConfig(process.env)
  } catch (error) {
    telegramCallbackLogger.error(
      'Telegram callback is not configured',
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const providedSecret = request.headers.get('x-telegram-bot-api-secret-token')
  if (!isValidSecret(providedSecret, config.telegram.webhookSecret)) {
    return NextResponse.json({ error: 'Invalid secret token' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const callbackQueryId = getCallbackQueryId(payload)

  if (!callbackQueryId) {
    try {
      const result = await handleTelegramPhotoMessage(payload)
      return NextResponse.json({ ok: true, result })
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid telegram message payload' },
        { status: 400 }
      )
    }
  }

  let action: TelegramAction
  try {
    action = await parseTelegramAction(payload)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid callback payload' },
      { status: 400 }
    )
  }

  try {
    const result = await handleTelegramAction(action)

    try {
      await getLineAssistantRuntime().telegramClient.answerCallbackQuery(
        callbackQueryId,
        buildAcknowledgementText(result.status)
      )
    } catch (error) {
      telegramCallbackLogger.error(
        'Telegram callback acknowledgement failed',
        error instanceof Error ? error : new Error(String(error))
      )
    }

    return NextResponse.json({ ok: true, result })
  } catch (error) {
    telegramCallbackLogger.error(
      'Telegram callback action failed',
      error instanceof Error ? error : new Error(String(error))
    )
    return NextResponse.json({ error: 'Callback action failed' }, { status: 500 })
  }
}
