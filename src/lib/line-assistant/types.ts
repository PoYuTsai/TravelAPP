export type NotionMatchConfidence = 'none' | 'low' | 'medium' | 'high'

export interface ReturningCustomerHint {
  hasSeenBeforeInSystem: boolean
  notionMatchConfidence: NotionMatchConfidence
  matchedNotionRecordIds: string[]
  previousInquiryDate?: string
}

export interface CustomerInquiry extends ReturningCustomerHint {
  id: string
  sourceEventId: string
  lineUserId: string
  customerName: string
  travelDates: string | null
  duration: string | null
  adults: number | null
  children: number | null
  childrenAges: string | null
  attractions: string[]
  budget: string | null
  accommodation: string | null
  specialNeeds: string[]
  inquiryType: 'new' | 'followup' | 'priceCheck' | 'booking' | 'other'
  urgency: 'high' | 'normal' | 'low'
  conversionSignal: boolean
  rawMessage: string
  rawMessagePreview: string
  timestamp: string
}

export type ConversationStatus =
  | 'new'
  | 'waiting_eric'
  | 'waiting_customer'
  | 'cold'
  | 'archived'
  | 'converted'
  | 'deleted'

export type ConversationContentType = 'text' | 'image' | 'sticker' | 'audio' | 'system'

export interface ConversationMessage {
  id: string
  source: 'line' | 'telegram' | 'system'
  role: 'customer' | 'eric' | 'assistant' | 'system'
  content: string
  contentType: ConversationContentType
  timestamp: string
  wasAiGenerated?: boolean
  wasEdited?: boolean
  originalDraft?: string
  lineMessageId?: string
  telegramMessageId?: string
  sourceEventId?: string
}

export interface Conversation {
  id: string
  lineUserId: string
  customerName: string
  status: ConversationStatus
  lastActivityAt: string
  lastProcessedLineEventId: string | null
  pendingDraftId: string | null
  latestInquiry: CustomerInquiry
  tgTopicId: string | null
  messages: ConversationMessage[]
  metadata: {
    archivedAt?: string
    convertedAt?: string
    deletedAt?: string
    cleanupReason?: 'stale_archive' | 'stale_prune' | 'manual_delete'
  }
}

export type DraftStatus =
  | 'pending'
  | 'sent'
  | 'edited_then_sent'
  | 'dismissed'
  | 'superseded'
  | 'failed'

export interface ConversationDraft {
  id: string
  conversationId: string
  createdAt: string
  createdFromEventId: string
  status: DraftStatus
  originalDraft: string
  editedDraft?: string
  sentAt?: string
  actionId?: string
  feedbackTags?: Array<'ok' | 'too_long' | 'too_formal' | 'too_cold'>
}

export interface InboundLineEventRecord {
  id: string
  lineEventId: string
  lineUserId: string
  eventType: 'message' | 'follow' | 'other'
  receivedAt: string
  processedAt?: string
  status: 'received' | 'processing' | 'processed' | 'ignored' | 'failed'
  failureReason?: string
  payload?: unknown
}

export interface TelegramActionContext {
  actionId: string
  sentAt: string
}

export interface LineAssistantConfig {
  siteUrl: string | null
  line: {
    channelAccessToken: string
    channelSecret: string
  }
  telegram: {
    botToken: string
    groupId: string
    webhookSecret: string | null
  }
  anthropic: {
    apiKey: string | null
  }
  openai: {
    apiKey: string | null
  }
  notion: {
    token: string | null
    customerDatabaseIds: Record<string, string>
  }
  storage: {
    mode: 'memory' | 'kv'
    kvRestApiUrl: string | null
    kvRestApiToken: string | null
  }
  cron: {
    secret: string | null
  }
}
