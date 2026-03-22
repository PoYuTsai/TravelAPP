export interface NormalizedLineMessageEvent {
  lineEventId: string
  lineUserId: string
  timestamp: string
  messageType: 'text' | 'image' | 'sticker' | 'audio' | 'unknown'
  text: string | null
  rawEvent: Record<string, unknown>
}

function normalizeMessageType(value: unknown): NormalizedLineMessageEvent['messageType'] {
  if (value === 'text' || value === 'image' || value === 'sticker' || value === 'audio') {
    return value
  }

  return 'unknown'
}

export function normalizeLineMessageEvents(payload: unknown): NormalizedLineMessageEvent[] {
  if (!payload || typeof payload !== 'object' || !('events' in payload)) {
    return []
  }

  const rawEvents = Array.isArray((payload as { events?: unknown[] }).events)
    ? (payload as { events: unknown[] }).events
    : []

  return rawEvents.flatMap((rawEvent) => {
    if (!rawEvent || typeof rawEvent !== 'object') {
      return []
    }

    const event = rawEvent as Record<string, unknown>
    const source = event.source as Record<string, unknown> | undefined
    const message = event.message as Record<string, unknown> | undefined

    if (event.type !== 'message' || !source || typeof source.userId !== 'string' || !message) {
      return []
    }

    const timestamp =
      typeof event.timestamp === 'number'
        ? new Date(event.timestamp).toISOString()
        : new Date().toISOString()

    return [
      {
        lineEventId:
          typeof event.webhookEventId === 'string'
            ? event.webhookEventId
            : `${source.userId}:${String(message.id ?? event.timestamp ?? 'unknown')}`,
        lineUserId: source.userId,
        timestamp,
        messageType: normalizeMessageType(message.type),
        text: typeof message.text === 'string' ? message.text : null,
        rawEvent: event,
      },
    ]
  })
}
