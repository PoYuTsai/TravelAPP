# Notion RAG Sources and Dedup Policy

> Scope: future LINE AI Agent itinerary RAG / similar-case traversal. This file records source-of-truth rules only. It does not enable Notion reads, does not contain real Notion database IDs, and does not change current partner-group responder behavior.
>
> `last_reviewed: 2026-06-05`

## Source Tables

Future Notion RAG should consider three read-only sources:

| Source | Env placeholder | Role | Mutability |
|---|---|---|---|
| 2026 團隊協作 | `NOTION_TEAM_2026_DATABASE_ID` | Partner/team-facing collaboration table, created after adding partners | Active, but duplicate subset |
| 2026 私人資料表 | `NOTION_PRIVATE_2026_DATABASE_ID` | Eric private full 2026 case table; includes itinerary field and richer private context | Active; may still receive new customer cases |
| 2025 私人資料表 | `NOTION_PRIVATE_2025_DATABASE_ID` | Eric private historical 2025 case table; real past itineraries | Frozen / immutable |

Do not put actual Notion database IDs in this repository. Add the two private table IDs only as deployment secrets / local env values when the implementation gate opens.

## Relationship Between 2026 Sources

2026 團隊協作裡面有的資料 = 2026 私人資料表也有。

Background:

- Eric originally had private 2025 and 2026 tables for real customer cases.
- After adding two partners, Eric created the 2026 團隊協作 table because profit sharing and team visibility required a separate collaboration surface.
- The team table was cloned/split from the private 2026 source.
- Therefore the 2026 team table should not be treated as an independent second corpus for itinerary RAG scoring.

Implication:

- RAG 檢索應優先用私人 2025/2026 做完整 traverse.
- If both 2026 團隊協作 and 2026 私人資料表 are enabled, dedupe by stable case identity before scoring.
- Do not let the same 2026 case appear twice in retrieved references.
- The 2026 team table can remain useful for partner-safe summaries and collaboration context, but private 2026 is the fuller itinerary source.

## Mutability Rules

- 2025 私人資料表是 frozen / immutable. It can be indexed, cached, and used as stable historical reference after field mapping is confirmed.
- 2026 私人資料表可能還會新增客人. It needs incremental refresh, updated indexing, and duplicate detection against any team-collaboration mirror.
- 2026 團隊協作 may continue changing for operations, but should be treated as a team collaboration view, not the canonical private itinerary corpus.

## Itinerary Field

The important field in the private tables is the itinerary field (`行程框架` / itinerary framework). These are real itineraries Chiangway arranged for actual customers, but not every record follows the parser-standard format.

Future ingestion should normalize messy Notion itinerary text into the same output family as:

- `parser_format: customer_itinerary_v1`
- `Day X｜...`
- `午餐：`
- `晚餐：`
- `・住宿：`

If a Notion case lacks a standard format, preserve the original facts but convert only the structure. Do not invent missing meals, dates, prices, hotels, flight details, or ticket costs.

## Access And Privacy

The private 2025/2026 tables may contain fields that should never be visible to partner group output.

Rules:

- Notion reads are read-only. No insert, update, archive, or writeback.
- Partner group output receives only sanitized reference points.
- Operator-only does not mean raw full access.
- 不要把成本、分潤、私人備註、Notion page URL、database ID 輸出到 partner group。
- Do not output cost, profit share, private notes, customer contact details, Notion page URL, token, or database ID.
- Do not output actual Notion database IDs to partner group, logs, generated itinerary text, or quote text.
- Keep IDs in env only: `NOTION_PRIVATE_2025_DATABASE_ID`, `NOTION_PRIVATE_2026_DATABASE_ID`, `NOTION_TEAM_2026_DATABASE_ID`.

## Retrieval Iteration Plan

Use a two-layer corpus model:

1. 第一層：markdown itinerary template library.
   - Source: `docs/ai-agent-knowledge/cases/itinerary-templates/`.
   - Purpose: curated, parser-shaped seed examples and SOP-backed templates.
   - Status: small but clean; best for prompt grounding and output format consistency.
2. 第二層：Notion traverse 後存成我們自己的 RAG/index database.
   - Source: private 2025/2026 Notion tables, with team 2026 deduped.
   - Purpose: larger real-case memory for similar-case retrieval, itinerary traverse, and partner-facing first-draft itinerary assistance.
   - Important: this internal index is for retrieval and organization, not formal quote writing.

有空先完整 traverse 一次，再寫入內部索引庫方便整理與檢索。Notion remains read-only; the internal RAG/index database is the derived retrieval layer.

Suggested iteration:

1. First pass: markdown itinerary templates in `cases/itinerary-templates/`.
2. Second pass: private 2025 frozen table, because it is stable and good for validating parser normalization.
3. Third pass: private 2026 active table, with incremental refresh.
4. Fourth pass: team 2026 table only for partner-safe collaboration context and dedupe checks.

The RAG ranking should favor:

- family / kids / elderly match
- days and nights
- area match: chiangmai, chiangrai, lampang, lamphun, mae_kampong, fang, inthanon
- activity match: elephant, night_safari, rainy_season, cafe, market, adventure, slow_travel
- operational facts: luggage, flights, child seat, long-drive tolerance, guide need

## Future Implementation Reminder

When Notion RAG implementation begins, add config support for:

- `NOTION_PRIVATE_2025_DATABASE_ID`
- `NOTION_PRIVATE_2026_DATABASE_ID`

Do this behind an explicit RAG/read gate. Do not enable private table traversal just because a Notion token exists.
