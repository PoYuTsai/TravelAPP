export type LineAssistantAuditOutcome = 'sent' | 'dismissed' | 'duplicate' | 'failed'

export interface LineAssistantAuditEntry {
  id: string
  actionId: string
  conversationId?: string
  draftId?: string
  lineUserId: string
  outcome: LineAssistantAuditOutcome
  createdAt: string
  detail?: string
  telegramUserId?: string
  telegramMessageId?: string
}

export interface AuditLog {
  append(entry: LineAssistantAuditEntry): Promise<void>
  list(): Promise<LineAssistantAuditEntry[]>
}

export function createMemoryAuditLog(initialEntries: LineAssistantAuditEntry[] = []): AuditLog & {
  listSync(): LineAssistantAuditEntry[]
} {
  const entries = [...initialEntries]

  return {
    async append(entry) {
      entries.push(entry)
    },
    async list() {
      return [...entries]
    },
    listSync() {
      return [...entries]
    },
  }
}
