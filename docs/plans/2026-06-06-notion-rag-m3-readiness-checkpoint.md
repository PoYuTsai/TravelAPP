# Notion RAG · M3 Readiness Checkpoint (2026-06-06)

Branch: `codex/line-oa-agent-mvp` (tip `4828fd3`). Docs-only readiness note — no
code changed this cut. Consolidates what the M3 Notion RAG layer can do today,
where its hard boundaries are, what the real-corpus smoke proved, and what is
still missing before any of this can face a live bot or customer.

`line-agent` suite at this tip: **737/737 green**. Real corpus: **90 pages / 90
records** read from Notion `private_2026`.

---

## 1. What works now

The retrieval pipeline is end-to-end functional from a real Notion database to a
masked operator preview:

- **Notion `private_2026` read** through the official SDK v5 data-source flow
  (query the data source under a database, not the legacy page-children path).
- **DB id normalization** — accepts either a Notion URL or a bare UUID and
  normalizes to the canonical id before querying.
- **Real schema field mapping** — maps the actual 2026 column names (with their
  aliases) onto the internal case record, not a guessed/demo schema.
- **Deterministic itinerary parser** — extracts `area` and `theme` framework
  tokens from itinerary free-text by rule, with no randomness, so the same input
  always yields the same tokens.
- **Theme vocabulary + family/kids** — a controlled theme vocab; `親子 / 小朋友 /
  family / kids` all fold into a single `family` retrieval token (GAP-2).
- **Free-text query bridge** — `parseRagQuery` turns a raw operator query string
  into structured `area / theme / partySize` signals; `retrieveRagCases` ranks
  the corpus against those signals.
- **Operator dry-run** — `notion-rag-dry-run` reads + maps + indexes the corpus
  without any side effect, so the index can be inspected offline.
- **Operator search preview** — `notion-rag-search` runs a real query against the
  live index and prints only masked, operator-safe structured facts.

---

## 2. Operator commands

Both are operator-only CLIs (CC/tmux runs them); neither is wired to any LINE
path. Both load `.env.local` via `tsx --env-file`.

```bash
# Read + map + index the real corpus, no query, no side effect
npm run agent:notion-rag-dry-run

# Parse a free-text query and print masked top results from the live index
npm run agent:notion-rag-search -- "清邁 親子 大象 夜間動物園"
```

---

## 3. Safety boundaries (what this layer must NOT do)

These are enforced by construction, not by convention:

- **No LINE live path** — retrieval is not connected to the webhook / router /
  send gate.
- **No customer OA auto-reply** — consistent with the standing CLAUDE.md rule;
  nothing here replies to a customer.
- **No Sanity write** — no quote build, no CMS import.
- **No scheduler / no cache** — every run is a fresh, explicit operator
  invocation; no cron, no persisted index.
- **No raw itinerary snippet output** — itinerary free-text is parsed into tokens
  and then dropped; the snippet itself never reaches operator output (GAP-1).
- **No `privateContext` in operator output** — the masked projection
  (`toOperatorSafeCaseSummary`) is a whitelist; private context is not projected.
- **No leakage of** token / DB id / Notion URL / customer name / cost / revenue /
  profit — none of these appear in any printed line.

---

## 4. Validated smoke results

Against the real 90-page / 90-record corpus through `notion-rag-search`:

- **90 pages / 90 records** read and indexed (full corpus, no truncation).
- **area token works** — e.g. `chiangmai`, `inthanon` parse and filter.
- **theme token works** — activity themes (elephant, night_safari, …) parse and
  rank.
- **family/kids works** — `親子 / 小朋友 / family / kids` all surface
  family-signal cases on top; `kids` dedupes into the single `family` token.
- **unknown query → low confidence** — a zero-signal query returns
  `low_confidence` rather than a fabricated match.
- **`6人包車` does not imply family or a vehicle promise** — partySize is parsed
  as a filter only; it never injects a `family` token and never promises a
  specific vehicle. A 6-person family case may still appear because it genuinely
  has 6 people, but the QUERY added no family claim.

(Detailed per-query tables live in the GAP-1 / GAP-2 masked-smoke checkpoints
dated 2026-06-06.)

---

## 5. Still NOT ready for a live bot

Retrieval is solid, but retrieval ≠ a bot. Before any live exposure this layer
still needs:

- **Retrieval output is operator-only** — it prints masked facts for a human
  operator, not a customer-facing answer.
- **Answer composition layer** — nothing turns retrieved cases into a written
  reply; that composer does not exist yet (M3.1).
- **Citation / source wording** — no agreed way to attribute "this is based on
  case X" without leaking case identity.
- **Cost / billing gate if web search is added later** — the M3-0 external-tool
  gate is in place (default OFF), but any paid provider must be wired through it
  before use.
- **Review queue / DK approval loop for learning** — no human-in-the-loop path to
  approve what the system "learns" from cases.
- **Partner-group UX rules** — no rules yet for how a RAG-assisted draft would
  appear in the partner LINE group before exposure.

---

## 6. Recommended next phases

Sequenced, smallest-safe-step first:

- **M3.1 — Answer composer from retrieved cases.** Turn the masked retrieval
  result into a draft answer; still operator-only, still no customer send.
- **M3.2 — Partner-group RAG-assisted draft only.** Surface a draft into the
  partner group as a suggestion; explicit send intent still required, no
  auto-send.
- **M3.3 — DK review queue / approval loop.** Human approves before any learned
  signal or drafted answer is trusted.
- **M3.4 — Optional ranking tuning.** Re-weight rarer themes for precision once
  more smoke data exists. Not now — current ranking is adequate and this is the
  lowest-priority item.

---

## Not done (by design)

- No code touched; readiness note only.
- Operator CLIs / index preview only; not wired to LINE live path; no Sanity, no
  quote, no LLM, no scheduler. Branch stays as-is (no merge/PR).
