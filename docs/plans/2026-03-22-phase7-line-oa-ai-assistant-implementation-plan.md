# Phase 7 LINE OA AI Assistant Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a safe, idempotent, async LINE OA to Telegram assistant that helps Eric review and send AI-assisted replies without changing the public frontend.

**Architecture:** Use a fast-ack LINE webhook that only verifies, deduplicates, and stores inbound events. Move state changes, AI extraction, topic management, draft generation, and callback actions into shared domain services backed by durable KV and Sanity / Notion integrations. Keep all outbound LINE sends behind audited action handlers so retries never double-send.

**Tech Stack:** Next.js 14 route handlers, TypeScript, `@line/bot-sdk`, Vercel KV, Sanity, existing Notion client, Anthropic API, Telegram Bot HTTP API, Vitest, Playwright smoke checks.

---

### Task 1: Config, Dependencies, and Storage Abstractions

**Files:**
- Modify: `package.json`
- Modify: `.env.example`
- Create: `src/lib/line-assistant/config.ts`
- Create: `src/lib/line-assistant/types.ts`
- Create: `src/lib/line-assistant/storage/idempotency-store.ts`
- Create: `src/lib/line-assistant/storage/conversation-store.ts`
- Create: `src/lib/line-assistant/storage/draft-store.ts`
- Test: `src/lib/line-assistant/__tests__/config.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { getLineAssistantConfig } from '../config'

describe('getLineAssistantConfig', () => {
  it('throws when required env vars are missing', () => {
    expect(() => getLineAssistantConfig({} as NodeJS.ProcessEnv)).toThrow()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/line-assistant/__tests__/config.test.ts`
Expected: FAIL because config helper does not exist yet.

**Step 3: Write minimal implementation**

```ts
export function getLineAssistantConfig(env: NodeJS.ProcessEnv) {
  const required = ['LINE_CHANNEL_ACCESS_TOKEN', 'LINE_CHANNEL_SECRET', 'TELEGRAM_BOT_TOKEN', 'TELEGRAM_GROUP_ID']
  for (const key of required) {
    if (!env[key]) throw new Error(`Missing ${key}`)
  }
  return { lineChannelAccessToken: env.LINE_CHANNEL_ACCESS_TOKEN! }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/line-assistant/__tests__/config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add package.json .env.example src/lib/line-assistant/config.ts src/lib/line-assistant/types.ts src/lib/line-assistant/storage/idempotency-store.ts src/lib/line-assistant/storage/conversation-store.ts src/lib/line-assistant/storage/draft-store.ts src/lib/line-assistant/__tests__/config.test.ts
git commit -m "feat: scaffold line assistant config and stores"
```

### Task 2: Conversation Domain Model and State Reducers

**Files:**
- Create: `src/lib/line-assistant/domain/conversation-reducer.ts`
- Create: `src/lib/line-assistant/domain/draft-lifecycle.ts`
- Create: `src/lib/line-assistant/domain/returning-customer.ts`
- Test: `src/lib/line-assistant/__tests__/conversation-reducer.test.ts`
- Test: `src/lib/line-assistant/__tests__/draft-lifecycle.test.ts`
- Test: `src/lib/line-assistant/__tests__/returning-customer.test.ts`

**Step 1: Write the failing tests**

```ts
it('supersedes the old pending draft when a new customer message arrives', () => {
  const next = reduceConversation(stateWithPendingDraft, incomingCustomerMessage)
  expect(next.pendingDraftId).not.toBe('draft-1')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/line-assistant/__tests__/conversation-reducer.test.ts src/lib/line-assistant/__tests__/draft-lifecycle.test.ts`
Expected: FAIL because reducer helpers do not exist yet.

**Step 3: Write minimal implementation**

```ts
export function reduceConversation(state: Conversation, event: ConversationEvent): Conversation {
  if (event.type === 'customer_message' && state.pendingDraftId) {
    return { ...state, status: 'waiting_eric', pendingDraftId: null }
  }
  return state
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/line-assistant/__tests__/conversation-reducer.test.ts src/lib/line-assistant/__tests__/draft-lifecycle.test.ts src/lib/line-assistant/__tests__/returning-customer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-assistant/domain/conversation-reducer.ts src/lib/line-assistant/domain/draft-lifecycle.ts src/lib/line-assistant/domain/returning-customer.ts src/lib/line-assistant/__tests__/conversation-reducer.test.ts src/lib/line-assistant/__tests__/draft-lifecycle.test.ts src/lib/line-assistant/__tests__/returning-customer.test.ts
git commit -m "feat: add line assistant conversation domain logic"
```

### Task 3: LINE Webhook Ingestion Route

**Files:**
- Create: `src/app/api/line-webhook/route.ts`
- Create: `src/lib/line-assistant/line/signature.ts`
- Create: `src/lib/line-assistant/line/normalize-event.ts`
- Create: `src/lib/line-assistant/line/client.ts`
- Create: `src/lib/line-assistant/process/ingest-line-events.ts`
- Test: `src/lib/line-assistant/__tests__/signature.test.ts`
- Test: `src/app/api/line-webhook/__tests__/route.test.ts`

**Step 1: Write the failing tests**

```ts
it('returns 200 and stores a new message event', async () => {
  const response = await POST(mockSignedLineRequest())
  expect(response.status).toBe(200)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/line-assistant/__tests__/signature.test.ts src/app/api/line-webhook/__tests__/route.test.ts`
Expected: FAIL because route and verification helpers do not exist yet.

**Step 3: Write minimal implementation**

```ts
export async function POST(request: NextRequest) {
  verifyLineSignature(request)
  await ingestLineEvents(request)
  return NextResponse.json({ ok: true })
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/line-assistant/__tests__/signature.test.ts src/app/api/line-webhook/__tests__/route.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/line-webhook/route.ts src/lib/line-assistant/line/signature.ts src/lib/line-assistant/line/normalize-event.ts src/lib/line-assistant/line/client.ts src/lib/line-assistant/process/ingest-line-events.ts src/lib/line-assistant/__tests__/signature.test.ts src/app/api/line-webhook/__tests__/route.test.ts
git commit -m "feat: add line webhook ingestion route"
```

### Task 4: Async Processor and Telegram Topic Management

**Files:**
- Create: `src/lib/line-assistant/process/process-inbound-event.ts`
- Create: `src/lib/line-assistant/telegram/client.ts`
- Create: `src/lib/line-assistant/telegram/topic-mapper.ts`
- Create: `src/lib/line-assistant/telegram/format-summary.ts`
- Test: `src/lib/line-assistant/__tests__/topic-mapper.test.ts`
- Test: `src/lib/line-assistant/__tests__/process-inbound-event.test.ts`

**Step 1: Write the failing tests**

```ts
it('creates one topic per line user id and reuses it for later messages', async () => {
  const first = await ensureTopicForLineUser('user-1')
  const second = await ensureTopicForLineUser('user-1')
  expect(second).toBe(first)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/line-assistant/__tests__/topic-mapper.test.ts src/lib/line-assistant/__tests__/process-inbound-event.test.ts`
Expected: FAIL because processor and topic mapper do not exist yet.

**Step 3: Write minimal implementation**

```ts
export async function processInboundEvent(record: InboundLineEventRecord) {
  const topicId = await ensureTopicForLineUser(record.lineUserId)
  await sendTopicSummary(topicId, record.lineUserId)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/line-assistant/__tests__/topic-mapper.test.ts src/lib/line-assistant/__tests__/process-inbound-event.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-assistant/process/process-inbound-event.ts src/lib/line-assistant/telegram/client.ts src/lib/line-assistant/telegram/topic-mapper.ts src/lib/line-assistant/telegram/format-summary.ts src/lib/line-assistant/__tests__/topic-mapper.test.ts src/lib/line-assistant/__tests__/process-inbound-event.test.ts
git commit -m "feat: add async processing and telegram topic mapping"
```

### Task 5: Inquiry Extraction and Notion Hint Integration

**Files:**
- Create: `src/lib/line-assistant/ai/extract-inquiry.ts`
- Create: `src/lib/line-assistant/notion/match-returning-customer.ts`
- Modify: `src/lib/notion/client.ts`
- Test: `src/lib/line-assistant/__tests__/extract-inquiry.test.ts`
- Test: `src/lib/line-assistant/__tests__/match-returning-customer.test.ts`

**Step 1: Write the failing tests**

```ts
it('returns high-confidence notion hints without replacing the line user identity', async () => {
  const hint = await matchReturningCustomer(mockInquiry())
  expect(hint.matchedNotionRecordIds.length).toBeGreaterThan(0)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/line-assistant/__tests__/extract-inquiry.test.ts src/lib/line-assistant/__tests__/match-returning-customer.test.ts`
Expected: FAIL because extractor and matcher do not exist yet.

**Step 3: Write minimal implementation**

```ts
export async function matchReturningCustomer() {
  return { notionMatchConfidence: 'none', matchedNotionRecordIds: [] }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/line-assistant/__tests__/extract-inquiry.test.ts src/lib/line-assistant/__tests__/match-returning-customer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-assistant/ai/extract-inquiry.ts src/lib/line-assistant/notion/match-returning-customer.ts src/lib/notion/client.ts src/lib/line-assistant/__tests__/extract-inquiry.test.ts src/lib/line-assistant/__tests__/match-returning-customer.test.ts
git commit -m "feat: add inquiry extraction and notion hint matching"
```

### Task 6: Draft Generation and Draft Persistence

**Files:**
- Create: `src/lib/line-assistant/ai/generate-draft.ts`
- Create: `src/lib/line-assistant/process/build-draft-context.ts`
- Modify: `src/lib/line-assistant/process/process-inbound-event.ts`
- Test: `src/lib/ai/__tests__/draft-generation.test.ts`
- Test: `src/lib/line-assistant/__tests__/build-draft-context.test.ts`

**Step 1: Write the failing tests**

```ts
it('marks the previous draft as superseded when a newer customer message arrives', async () => {
  const result = await generateDraftForConversation(stateWithPendingDraft)
  expect(result.status).toBe('pending')
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ai/__tests__/draft-generation.test.ts src/lib/line-assistant/__tests__/build-draft-context.test.ts`
Expected: FAIL because draft services do not exist yet.

**Step 3: Write minimal implementation**

```ts
export async function generateDraftForConversation(conversation: Conversation) {
  return { id: 'draft-1', status: 'pending', originalDraft: '...' }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ai/__tests__/draft-generation.test.ts src/lib/line-assistant/__tests__/build-draft-context.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/line-assistant/ai/generate-draft.ts src/lib/line-assistant/process/build-draft-context.ts src/lib/line-assistant/process/process-inbound-event.ts src/lib/ai/__tests__/draft-generation.test.ts src/lib/line-assistant/__tests__/build-draft-context.test.ts
git commit -m "feat: add line assistant draft generation"
```

### Task 7: Telegram Callback Route and Safe Outbound LINE Sends

**Files:**
- Create: `src/app/api/telegram-callback/route.ts`
- Create: `src/lib/line-assistant/actions/handle-telegram-action.ts`
- Create: `src/lib/line-assistant/line/send-message.ts`
- Create: `src/lib/line-assistant/audit-log.ts`
- Test: `src/app/api/telegram-callback/__tests__/route.test.ts`
- Test: `src/lib/line-assistant/__tests__/handle-telegram-action.test.ts`

**Step 1: Write the failing tests**

```ts
it('sends a draft exactly once even if the callback is retried', async () => {
  await handleTelegramAction(sendAction)
  await handleTelegramAction(sendAction)
  expect(mockSendLineMessage).toHaveBeenCalledTimes(1)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/telegram-callback/__tests__/route.test.ts src/lib/line-assistant/__tests__/handle-telegram-action.test.ts`
Expected: FAIL because action handler does not exist yet.

**Step 3: Write minimal implementation**

```ts
export async function handleTelegramAction(action: TelegramAction) {
  if (await hasProcessedAction(action.id)) return
  await sendLineMessage(action.lineUserId, action.text)
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/telegram-callback/__tests__/route.test.ts src/lib/line-assistant/__tests__/handle-telegram-action.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/telegram-callback/route.ts src/lib/line-assistant/actions/handle-telegram-action.ts src/lib/line-assistant/line/send-message.ts src/lib/line-assistant/audit-log.ts src/app/api/telegram-callback/__tests__/route.test.ts src/lib/line-assistant/__tests__/handle-telegram-action.test.ts
git commit -m "feat: add telegram callback actions and audited line sends"
```

### Task 8: Housekeeping, Daily Summary, and Weekly Prompt Review

**Files:**
- Create: `src/app/api/cron/line-assistant-housekeeping/route.ts`
- Create: `src/app/api/cron/line-assistant-daily-summary/route.ts`
- Create: `src/app/api/cron/line-assistant-weekly-report/route.ts`
- Create: `src/lib/line-assistant/jobs/housekeeping.ts`
- Create: `src/lib/line-assistant/jobs/daily-summary.ts`
- Create: `src/lib/line-assistant/jobs/weekly-report.ts`
- Test: `src/lib/line-assistant/__tests__/housekeeping.test.ts`
- Test: `src/lib/line-assistant/__tests__/weekly-report.test.ts`

**Step 1: Write the failing tests**

```ts
it('archives conversations after 7 days and prunes raw content after 30 days', async () => {
  const result = await runHousekeeping(fixtures)
  expect(result.archivedCount).toBe(1)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/line-assistant/__tests__/housekeeping.test.ts src/lib/line-assistant/__tests__/weekly-report.test.ts`
Expected: FAIL because jobs do not exist yet.

**Step 3: Write minimal implementation**

```ts
export async function runHousekeeping() {
  return { archivedCount: 0, prunedCount: 0 }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/line-assistant/__tests__/housekeeping.test.ts src/lib/line-assistant/__tests__/weekly-report.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/app/api/cron/line-assistant-housekeeping/route.ts src/app/api/cron/line-assistant-daily-summary/route.ts src/app/api/cron/line-assistant-weekly-report/route.ts src/lib/line-assistant/jobs/housekeeping.ts src/lib/line-assistant/jobs/daily-summary.ts src/lib/line-assistant/jobs/weekly-report.ts src/lib/line-assistant/__tests__/housekeeping.test.ts src/lib/line-assistant/__tests__/weekly-report.test.ts
git commit -m "feat: add line assistant housekeeping and reporting jobs"
```

### Task 9: Sanity Schemas, Migration Utilities, and Final Verification

**Files:**
- Create: `src/sanity/schemas/learningConversation.ts`
- Create: `src/sanity/schemas/promptVersion.ts`
- Create: `src/sanity/schemas/itineraryTemplate.ts`
- Modify: `src/sanity/schemas/index.ts`
- Modify: `src/sanity/structure.ts`
- Create: `scripts/import-learning-conversations.ts`
- Create: `docs/plans/2026-03-22-phase7-line-oa-ai-assistant-rollout-checklist.md`

**Step 1: Write the failing tests**

```ts
it('exports the new line assistant schemas from the schema index', async () => {
  expect(schemaTypes.some((schema) => schema.name === 'learningConversation')).toBe(true)
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/line-assistant/__tests__/schema-registration.test.ts`
Expected: FAIL because schemas do not exist yet.

**Step 3: Write minimal implementation**

```ts
export default defineType({ name: 'learningConversation', type: 'document', fields: [] })
```

**Step 4: Run full verification**

Run: `npm run lint`
Expected: PASS

Run: `npm run test:run`
Expected: PASS

Run: `npm run build`
Expected: PASS

**Step 5: Commit**

```bash
git add src/sanity/schemas/learningConversation.ts src/sanity/schemas/promptVersion.ts src/sanity/schemas/itineraryTemplate.ts src/sanity/schemas/index.ts src/sanity/structure.ts scripts/import-learning-conversations.ts docs/plans/2026-03-22-phase7-line-oa-ai-assistant-rollout-checklist.md
git commit -m "feat: add line assistant schemas and rollout checklist"
```

---

## Execution Notes

- Keep the public frontend unchanged.
- Reuse existing logger patterns and secured route conventions from `src/app/api/auth/session/route.ts`.
- Do not trust in-memory rate limiting for webhook idempotency.
- Prefer shared domain services under `src/lib/line-assistant/` over large route handlers.
- Treat Notion matching as a hint, never as the identity source of truth.

## Review Gates Before Merge

1. Security pass on webhook signature, callback secret, token handling, and replay protection.
2. Data governance pass on Telegram exposure, retention rules, and delete behavior.
3. Prompt / tone pass with Eric-provided benchmark cases.
4. Failure mode pass covering LINE, Telegram, AI, Notion, and cron retries.
5. Manual pilot with real but low-risk conversations before full rollout.
