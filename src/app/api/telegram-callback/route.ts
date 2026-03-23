import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { getLineAssistantConfig } from '@/lib/line-assistant/config'
import { handleTelegramAction } from '@/lib/line-assistant/actions/handle-telegram-action'
import { getLineAssistantRuntime } from '@/lib/line-assistant/runtime'
import type { TelegramAction, TelegramActionType } from '@/lib/line-assistant/types'
import { apiLogger } from '@/lib/logger'

const telegramCallbackLogger = apiLogger.child('telegram-callback')

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
      telegramUserId: typeof from?.id === 'number' ? String(from.id) : storedAction.action.telegramUserId,
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

  let action: TelegramAction
  const callbackQueryId = getCallbackQueryId(payload)
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

    if (callbackQueryId) {
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
