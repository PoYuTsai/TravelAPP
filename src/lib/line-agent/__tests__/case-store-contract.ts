/**
 * case-store-contract.ts
 *
 * Shared behavioural contract for the CaseStore interface.
 *
 * Both MemoryStore (tests/local) and KvStore (production) MUST satisfy the
 * same observable behaviour.  This suite is parameterised over a store factory
 * and invoked from BOTH memory-store.test.ts and kv-store.test.ts so the two
 * implementations can never silently diverge.
 *
 * It is intentionally NOT a *.test.ts file — it exports a function that a real
 * test file calls inside its own module, so Vitest only collects it once per
 * caller (with the caller's label).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { CaseStore } from '../storage/store'
import { createInitialCase, type AgentCase } from '../cases/case-state'

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

/**
 * Run the full CaseStore behavioural contract against a store produced by
 * `makeStore`.  The factory is called fresh in `beforeEach` so each test gets
 * an isolated store.
 */
export function runCaseStoreContract(
  label: string,
  makeStore: () => CaseStore | Promise<CaseStore>
): void {
  describe(`CaseStore contract: ${label}`, () => {
    let store: CaseStore

    beforeEach(async () => {
      store = await makeStore()
    })

    // ── put / get round-trip ────────────────────────────────────────────────

    it('put then get returns an equivalent case', async () => {
      const alice = makeAlice()
      await store.put(alice)
      const got = await store.get(alice.caseId)
      expect(got).not.toBeNull()
      expect(got?.caseId).toBe('CW-0601-001')
      expect(got?.lineUserId).toBe('Uaaa111')
      expect(got?.status).toBe('new_inquiry')
    })

    it('get returns null for an unknown caseId', async () => {
      expect(await store.get('NONEXISTENT-999')).toBeNull()
    })

    // ── upsert by caseId ────────────────────────────────────────────────────

    it('a second put with the same caseId updates in place (no duplicate)', async () => {
      const alice = makeAlice()
      await store.put(alice)
      await store.put({ ...alice, status: 'needs_info' })

      const got = await store.get(alice.caseId)
      expect(got?.status).toBe('needs_info')

      const all = await store.listAll()
      expect(all.filter((c) => c.caseId === alice.caseId)).toHaveLength(1)
    })

    // ── listAll / listByStatus ──────────────────────────────────────────────

    it('listAll returns all stored cases and [] when empty', async () => {
      expect(await store.listAll()).toHaveLength(0)
      await store.put(makeAlice())
      await store.put(makeBob())
      const ids = (await store.listAll()).map((c) => c.caseId).sort()
      expect(ids).toEqual(['CW-0601-001', 'CW-0601-002'])
    })

    it('listByStatus returns only matching cases', async () => {
      await store.put(makeAlice()) // new_inquiry
      await store.put({ ...makeBob(), status: 'needs_info' })

      const newInquiries = await store.listByStatus('new_inquiry')
      expect(newInquiries.map((c) => c.caseId)).toEqual(['CW-0601-001'])

      const needsInfo = await store.listByStatus('needs_info')
      expect(needsInfo.map((c) => c.caseId)).toEqual(['CW-0601-002'])
    })

    // ── getByLineUserId ─────────────────────────────────────────────────────

    it('getByLineUserId returns the active case for a user', async () => {
      await store.put(makeAlice())
      const got = await store.getByLineUserId('Uaaa111')
      expect(got?.customerDisplayName).toBe('Alice')
    })

    it('getByLineUserId returns null for an unknown user', async () => {
      expect(await store.getByLineUserId('Unobody')).toBeNull()
    })

    // ── CONTRACT: terminal case must drop out of the active index ────────────
    // MemoryStore excludes terminal cases at read time; KvStore must del the
    // lineUser→activeCase index at write time.  Both must agree: once a case
    // is terminal, getByLineUserId returns null, but the record is still
    // retrievable by caseId.

    it('getByLineUserId returns null after the case becomes terminal (converted)', async () => {
      const alice = makeAlice()
      await store.put(alice)
      expect(await store.getByLineUserId('Uaaa111')).not.toBeNull()

      await store.put({ ...alice, status: 'converted' })
      expect(await store.getByLineUserId('Uaaa111')).toBeNull()
      // The record itself is preserved — only the active index is cleared.
      expect(await store.get(alice.caseId)).not.toBeNull()
    })

    it('getByLineUserId returns null after the case is marked lost (terminal)', async () => {
      const alice = makeAlice()
      await store.put(alice)
      await store.put({ ...alice, status: 'lost', lostReason: 'budget' })
      expect(await store.getByLineUserId('Uaaa111')).toBeNull()
    })

    // ── delete ──────────────────────────────────────────────────────────────

    it('delete removes the case so get returns null afterwards', async () => {
      const alice = makeAlice()
      await store.put(alice)
      await store.delete(alice.caseId)
      expect(await store.get(alice.caseId)).toBeNull()
      expect(await store.getByLineUserId('Uaaa111')).toBeNull()
    })

    it('delete on a non-existent caseId does not throw', async () => {
      await expect(store.delete('NONEXISTENT-999')).resolves.not.toThrow()
    })

    // ── CRITICAL: two customers never collapse ──────────────────────────────

    it('two different lineUserIds get two distinct records', async () => {
      await store.put(makeAlice())
      await store.put(makeBob())
      const a = await store.get('CW-0601-001')
      const b = await store.get('CW-0601-002')
      expect(a?.lineUserId).toBe('Uaaa111')
      expect(b?.lineUserId).toBe('Ubbb222')
      expect(a?.caseId).not.toBe(b?.caseId)
    })

    // ── audit log ───────────────────────────────────────────────────────────

    it('appendAudit + getAudit returns entries in insertion order', async () => {
      const alice = makeAlice()
      await store.put(alice)
      await store.appendAudit(alice.caseId, {
        caseId: alice.caseId,
        from: 'new_inquiry',
        to: 'needs_info',
        eventType: 'needs_info',
        actor: 'partner',
        timestamp: T0,
      })
      await store.appendAudit(alice.caseId, {
        caseId: alice.caseId,
        from: 'needs_info',
        to: 'ready_for_itinerary',
        eventType: 'ready_for_itinerary',
        actor: 'partner',
        timestamp: T1,
      })
      const entries = await store.getAudit(alice.caseId)
      expect(entries).toHaveLength(2)
      expect(entries[0].to).toBe('needs_info')
      expect(entries[1].to).toBe('ready_for_itinerary')
    })

    it('getAudit returns [] for a case with no audit entries', async () => {
      expect(await store.getAudit('CW-no-audit')).toHaveLength(0)
    })

    // ── partner-reply send-once claim (tagged-reply plan §4) ──────────────────
    // A cross-instance, store-backed "send-once" marker — NOT case state.
    // Partner-group tagged messages are never persisted as cases, so the
    // dedupe guard lives in its own namespace.  claimPartnerReply is atomic:
    // the FIRST caller for a messageId wins (true) and every later caller for
    // the same id loses (false), so a LINE redelivery (or a concurrent
    // serverless instance) can never re-bill the responder or send twice.

    it('claimPartnerReply returns true the first time and false on redelivery', async () => {
      expect(await store.claimPartnerReply('M-partner-001')).toBe(true)
      expect(await store.claimPartnerReply('M-partner-001')).toBe(false)
      expect(await store.claimPartnerReply('M-partner-001')).toBe(false)
    })

    it('claimPartnerReply is independent per messageId', async () => {
      expect(await store.claimPartnerReply('M-a')).toBe(true)
      expect(await store.claimPartnerReply('M-b')).toBe(true)
      expect(await store.claimPartnerReply('M-a')).toBe(false)
      expect(await store.claimPartnerReply('M-b')).toBe(false)
    })

    it('partner-reply claims never appear in case space (no listAll/get pollution)', async () => {
      await store.claimPartnerReply('M-partner-xyz')
      expect(await store.listAll()).toHaveLength(0)
      expect(await store.get('M-partner-xyz')).toBeNull()
    })

    it('appendAudit does not cross-contaminate between cases', async () => {
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
      expect(await store.getAudit(bob.caseId)).toHaveLength(0)
    })
  })
}
