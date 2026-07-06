# Chiangway AI Agent Knowledge Base

> **Canonical location**: `docs/ai-agent-knowledge/` — one folder only. Do NOT scatter travel rules, package examples, or restaurant notes into other docs locations.
>
> **Maintenance rule**: When a rule, package, or venue changes, update ONLY the relevant file here. Add a `last_verified` date stamp. If you cannot verify a fact, mark it `需驗證 (unverified)` and use the `chiangway-web-research` skill before including it in a quote or itinerary.

## Categories

| File | Contents |
|------|----------|
| `rules/family-pacing.md` | Family pacing rules — young-child limits, rest stops, day length, water/night activity combinations |
| `rules/flight-and-car-time.md` | Airline arrival/departure rules, Day 1 touring availability, car time standards (清邁 10h / 清萊 12h), overtime policy, point-transfer pricing |
| `rules/quote-included-excluded.md` | Standard included/excluded items for all package types, currency rules, tip and insurance policy |
| `rules/itinerary-template-and-parser-format.md` | SOP for turning Eric-pasted itineraries into AI-readable templates that still fit the quote parser shape |
| `rules/notion-rag-sources.md` | Future Notion RAG source policy: private 2025/2026 tables, team 2026 dedupe, ID hygiene, and read-only boundaries |
| `cases/production-packages.md` | Production package examples from LINE rich menu — 5-day family, day charter, Chiang Rai cross-region, etc. |
| `cases/itinerary-templates/*.md` | Parser-shaped itinerary template library from Eric-pasted reference cases; each full case has YAML metadata and `parser_format: customer_itinerary_v1` |
| `restaurants-and-hotels.md` | Restaurant and hotel categories, operating days, special notes, Google Maps references |

## How The AI Agent Uses These Files

1. **Skills read these files first** before answering questions about Chiangway rules, packages, or venues.
2. **Current facts** (ticket prices, hours, closures, seasonal dates) must always be verified via `chiangway-web-research` regardless of what is written here — these files provide context, not real-time data.
3. **Notion 2026 团隊協作** is the source of confirmed case records. This knowledge base is the source of rules and reference templates.
4. **Additions to this folder** must be reviewed by Eric before the AI agent treats them as authoritative.
5. **Itinerary templates** are not casual notes. They are retrieval/reference cases for producing first-draft itineraries and must preserve the `Day X｜...`, `午餐：`, `晚餐：`, and `・住宿：` parser shape.
6. **Future Notion RAG** should treat Eric's private 2025/2026 tables as the fuller itinerary corpus, with the 2026 team table deduped against private 2026 before retrieval.

## Update Protocol

- Add `last_verified: YYYY-MM-DD` to any fact that may change (ticket prices, hours, seasonal rules).
- Mark unstable facts with `需驗證` so skills know to web-search before using.
- Never copy API keys, tokens, or customer personal data into these files.
- After a real customer case reveals a rule gap, add it here within the same session.
