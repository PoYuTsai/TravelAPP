/**
 * itinerary-reference-source.ts — design 2026-06-14 §4。
 *
 * 新客需 → retrieveRagCases 取候選 → toItineraryReference（含 sanitizer）。
 * 有真案例優先；low_confidence（無訊號/無命中）或全數 fail-closed ⇒ 退回手工
 * 「清邁親子5天4夜經典套餐」markdown 骨架。絕不讓 LLM 從零亂編。
 */
import fs from 'node:fs'
import path from 'node:path'
import type { RagIndex } from './rag-index'
import { retrieveRagCases } from './rag-query'
import { toItineraryReference } from './itinerary-reference'

const TEMPLATE_REL =
  'docs/ai-agent-knowledge/cases/itinerary-templates/chiang-mai-family-5d4n-classic.md'

export interface SelectedReference {
  source: 'case' | 'template'
  skeleton: string
}

/** 去 YAML frontmatter，回 markdown body 當骨架。 */
function templateSkeleton(): string {
  const md = fs.readFileSync(path.join(process.cwd(), TEMPLATE_REL), 'utf8')
  return md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').trim()
}

export function selectItineraryReference(index: RagIndex, need: string): SelectedReference {
  const hits = retrieveRagCases(index, need)
  for (const hit of hits) {
    const ref = toItineraryReference(hit)
    if (ref) return { source: 'case', skeleton: ref.skeleton } // 第一個 sanitize 成功的即用
  }
  return { source: 'template', skeleton: templateSkeleton() }
}
