import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const repoRoot = process.cwd()

function readRepoFile(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8')
}

describe('partner RAG type imports', () => {
  it('imports AgentSourceChannel from the public line-agent types module', () => {
    const surfacing = readRepoFile(
      'src/lib/line-agent/partner-group/rag-draft-surfacing.ts',
    )
    const factoryTest = readRepoFile(
      'src/lib/line-agent/__tests__/partner-rag-factory-selection.test.ts',
    )

    expect(surfacing).not.toContain(
      "import type { AgentSourceChannel } from '../line/event-normalizer'",
    )
    expect(factoryTest).not.toContain(
      "import type { AgentSourceChannel } from '@/lib/line-agent/line/event-normalizer'",
    )
    expect(surfacing).toContain(
      "import type { AgentSourceChannel } from '../types'",
    )
    expect(factoryTest).toContain(
      "import type { AgentSourceChannel } from '@/lib/line-agent/types'",
    )
  })
})
