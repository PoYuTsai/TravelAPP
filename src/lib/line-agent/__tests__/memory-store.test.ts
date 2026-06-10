/**
 * Tests for the in-memory CaseStore implementation.
 *
 * Covers: put/get/list round-trip, update preserves identity,
 * listing by status, and that two different customers get two
 * distinct case records (never collapsed).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryStore } from '../storage/memory-store'
import { BOT_AUTHORED_CONTENT_MAX_CHARS } from '../storage/store'
import { createInitialCase } from '../cases/case-state'
import type { AgentCase } from '../cases/case-state'
import { runCaseStoreContract } from './case-store-contract'

// Shared behavioural contract — the same suite runs against KvStore so the two
// implementations cannot silently diverge.
runCaseStoreContract('MemoryStore', () => new MemoryStore())

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const T0 = '2026-06-01T08:00:00.000Z'
const T1 = '2026-06-01T09:00:00.000Z'

function makeAlice(): AgentCase {
  return createInitialCase({
    caseId: 'CW-0601-001',
    lineUserId: 'Uaaa111',
    customerDisplayName: 'Alice',
    now: T0,
  })
}

function makeBob(): AgentCase {
  return createInitialCase({
    caseId: 'CW-0601-002',
    lineUserId: 'Ubbb222',
    customerDisplayName: 'Bob',
    now: T0,
  })
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemoryStore', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
  })

  // ── put / get round-trip ──────────────────────────────────────────────────

  it('put then get returns the same case', async () => {
    const alice = makeAlice()
    await store.put(alice)
    const retrieved = await store.get(alice.caseId)
    expect(retrieved).not.toBeNull()
    expect(retrieved?.caseId).toBe('CW-0601-001')
    expect(retrieved?.lineUserId).toBe('Uaaa111')
    expect(retrieved?.status).toBe('new_inquiry')
  })

  it('get returns null for an unknown caseId', async () => {
    const result = await store.get('NONEXISTENT-999')
    expect(result).toBeNull()
  })

  // ── update preserves identity ─────────────────────────────────────────────

  it('putting an updated case preserves the original caseId (upsert by caseId)', async () => {
    const alice = makeAlice()
    await store.put(alice)

    const updated: AgentCase = { ...alice, status: 'needs_info' }
    await store.put(updated)

    const retrieved = await store.get(alice.caseId)
    expect(retrieved?.caseId).toBe(alice.caseId)
    expect(retrieved?.status).toBe('needs_info')
  })

  it('update does not change the total count (still one record for that caseId)', async () => {
    const alice = makeAlice()
    await store.put(alice)
    await store.put({ ...alice, status: 'needs_info' })
    await store.put({ ...alice, status: 'ready_for_itinerary' })

    const all = await store.listAll()
    // Still just one case for Alice despite multiple puts
    const aliceCases = all.filter((c) => c.caseId === alice.caseId)
    expect(aliceCases).toHaveLength(1)
  })

  // ── listAll ───────────────────────────────────────────────────────────────

  it('listAll returns all stored cases', async () => {
    const alice = makeAlice()
    const bob = makeBob()
    await store.put(alice)
    await store.put(bob)
    const all = await store.listAll()
    expect(all).toHaveLength(2)
    const ids = all.map((c) => c.caseId)
    expect(ids).toContain('CW-0601-001')
    expect(ids).toContain('CW-0601-002')
  })

  it('listAll returns empty array when store is empty', async () => {
    const all = await store.listAll()
    expect(all).toHaveLength(0)
  })

  // ── listByStatus ──────────────────────────────────────────────────────────

  it('listByStatus returns only cases matching the given status', async () => {
    const alice = makeAlice()
    const bob = makeBob()
    const bobWithStatus: AgentCase = { ...bob, status: 'needs_info' }

    await store.put(alice)           // new_inquiry
    await store.put(bobWithStatus)   // needs_info

    const newInquiries = await store.listByStatus('new_inquiry')
    expect(newInquiries).toHaveLength(1)
    expect(newInquiries[0].caseId).toBe('CW-0601-001')

    const needsInfo = await store.listByStatus('needs_info')
    expect(needsInfo).toHaveLength(1)
    expect(needsInfo[0].caseId).toBe('CW-0601-002')
  })

  it('listByStatus returns empty array when no cases match', async () => {
    await store.put(makeAlice())
    const converted = await store.listByStatus('converted')
    expect(converted).toHaveLength(0)
  })

  // ── getByLineUserId ───────────────────────────────────────────────────────

  it('getByLineUserId returns the active case for a LINE user', async () => {
    await store.put(makeAlice())
    const result = await store.getByLineUserId('Uaaa111')
    expect(result).not.toBeNull()
    expect(result?.customerDisplayName).toBe('Alice')
  })

  it('getByLineUserId returns null when no case exists for that user', async () => {
    const result = await store.getByLineUserId('Unobody')
    expect(result).toBeNull()
  })

  // ── delete ────────────────────────────────────────────────────────────────

  it('delete removes the case so get returns null afterwards', async () => {
    const alice = makeAlice()
    await store.put(alice)
    await store.delete(alice.caseId)
    const result = await store.get(alice.caseId)
    expect(result).toBeNull()
  })

  it('delete on a non-existent caseId does not throw', async () => {
    await expect(store.delete('NONEXISTENT-999')).resolves.not.toThrow()
  })

  // ── CRITICAL: two different customers → two distinct records ──────────────

  it('CRITICAL: two different customers with different lineUserIds get two distinct records — never collapsed', async () => {
    const alice = makeAlice()  // lineUserId: Uaaa111
    const bob = makeBob()      // lineUserId: Ubbb222

    await store.put(alice)
    await store.put(bob)

    const retrievedAlice = await store.get(alice.caseId)
    const retrievedBob = await store.get(bob.caseId)

    expect(retrievedAlice).not.toBeNull()
    expect(retrievedBob).not.toBeNull()
    // They must be distinct records
    expect(retrievedAlice?.lineUserId).toBe('Uaaa111')
    expect(retrievedBob?.lineUserId).toBe('Ubbb222')
    expect(retrievedAlice?.caseId).not.toBe(retrievedBob?.caseId)
    expect(retrievedAlice?.customerDisplayName).toBe('Alice')
    expect(retrievedBob?.customerDisplayName).toBe('Bob')
  })

  it('CRITICAL: updating one customer case does NOT affect the other customer', async () => {
    const alice = makeAlice()
    const bob = makeBob()

    await store.put(alice)
    await store.put(bob)

    // Update Alice to needs_info
    await store.put({ ...alice, status: 'needs_info', lastCustomerMessageAt: T1 })

    // Bob must be unchanged
    const bobRetrieved = await store.get(bob.caseId)
    expect(bobRetrieved?.status).toBe('new_inquiry')
    expect(bobRetrieved?.lineUserId).toBe('Ubbb222')
  })

  it('CRITICAL: same displayName but different lineUserId → two distinct cases', async () => {
    // Name collision must NOT cause collapsing
    const caseA = createInitialCase({
      caseId: 'CW-0601-A',
      lineUserId: 'Uidentical-name-A',
      customerDisplayName: 'Wang Xiao Ming',
      now: T0,
    })
    const caseB = createInitialCase({
      caseId: 'CW-0601-B',
      lineUserId: 'Uidentical-name-B',
      customerDisplayName: 'Wang Xiao Ming',  // Same name, different user!
      now: T0,
    })

    await store.put(caseA)
    await store.put(caseB)

    const all = await store.listAll()
    expect(all).toHaveLength(2)
    const retrievedA = await store.get('CW-0601-A')
    const retrievedB = await store.get('CW-0601-B')
    expect(retrievedA?.lineUserId).toBe('Uidentical-name-A')
    expect(retrievedB?.lineUserId).toBe('Uidentical-name-B')
  })

  // ── appendAudit ───────────────────────────────────────────────────────────

  it('appendAudit adds an entry and getAudit returns all entries for a case', async () => {
    const alice = makeAlice()
    await store.put(alice)
    await store.appendAudit(alice.caseId, {
      caseId: alice.caseId,
      from: 'new_inquiry',
      to: 'needs_info',
      eventType: 'needs_info',
      actor: 'partner',
      timestamp: T1,
    })
    const entries = await store.getAudit(alice.caseId)
    expect(entries).toHaveLength(1)
    expect(entries[0].to).toBe('needs_info')
  })

  it('appendAudit for different cases does not cross-contaminate', async () => {
    const alice = makeAlice()
    const bob = makeBob()
    await store.put(alice)
    await store.put(bob)

    await store.appendAudit(alice.caseId, {
      caseId: alice.caseId,
      from: 'new_inquiry',
      to: 'needs_info',
      eventType: 'needs_info',
      actor: 'partner',
      timestamp: T1,
    })

    const bobAudit = await store.getAudit(bob.caseId)
    expect(bobAudit).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Bot-authored partner-group message tracking (quote-to-bot plan §2 / Task 1)
// ---------------------------------------------------------------------------

describe('bot-authored partner message tracking', () => {
  it('round-trips put → is', async () => {
    const store = new MemoryStore()
    expect(await store.isBotAuthoredPartnerMsg('Mb1')).toBe(false)
    await store.putBotAuthoredPartnerMsg('Mb1')
    expect(await store.isBotAuthoredPartnerMsg('Mb1')).toBe(true)
  })

  it('empty id: put is no-op, is returns false', async () => {
    const store = new MemoryStore()
    await store.putBotAuthoredPartnerMsg('')
    expect(await store.isBotAuthoredPartnerMsg('')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Bot-authored partner-group message CONTENT cache (M3.6c quote-to-bot carryover)
// ---------------------------------------------------------------------------

describe('bot-authored partner message content cache', () => {
  it('round-trips put(id, content) → getBotAuthoredPartnerMsgContent', async () => {
    const store = new MemoryStore()
    expect(await store.getBotAuthoredPartnerMsgContent('Mc1')).toBeNull()
    await store.putBotAuthoredPartnerMsg('Mc1', '【夥伴內部草稿】清邁親子 5 天行程草稿')
    expect(await store.getBotAuthoredPartnerMsgContent('Mc1')).toBe(
      '【夥伴內部草稿】清邁親子 5 天行程草稿',
    )
    // The id flag is still set independently of the content.
    expect(await store.isBotAuthoredPartnerMsg('Mc1')).toBe(true)
  })

  it('returns null when only the id (no content) was recorded — backward compatible', async () => {
    const store = new MemoryStore()
    await store.putBotAuthoredPartnerMsg('Mc2')
    expect(await store.isBotAuthoredPartnerMsg('Mc2')).toBe(true)
    expect(await store.getBotAuthoredPartnerMsgContent('Mc2')).toBeNull()
  })

  it('returns null for an empty id', async () => {
    const store = new MemoryStore()
    expect(await store.getBotAuthoredPartnerMsgContent('')).toBeNull()
  })

  it('caps stored content length', async () => {
    const store = new MemoryStore()
    const huge = 'x'.repeat(BOT_AUTHORED_CONTENT_MAX_CHARS + 1000)
    await store.putBotAuthoredPartnerMsg('Mc3', huge)
    const got = await store.getBotAuthoredPartnerMsgContent('Mc3')
    expect(got?.length).toBe(BOT_AUTHORED_CONTENT_MAX_CHARS)
  })
})
