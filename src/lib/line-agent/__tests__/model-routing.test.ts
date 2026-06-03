/**
 * model-routing.test.ts — pure intent→model mapping (design 2026-06-03 §4).
 *
 * No I/O, no env. respond/analyze/unknown → default; draft/parse → research;
 * any unlisted action → default (fallback).
 */

import { describe, it, expect } from 'vitest'
import { routePartnerModel } from '@/lib/line-agent/partner-group/model-routing'
import type { CommandIntent, IntentAction } from '@/lib/line-agent/commands/intent'

const MODELS = { defaultModel: 'claude-default', researchModel: 'claude-research' }

function intent(action: IntentAction): CommandIntent {
  return { action, confidence: 'high', source: 'llm' }
}

describe('routePartnerModel', () => {
  it.each<IntentAction>(['respond', 'analyze', 'unknown'])(
    'routes %s to the default model',
    (action) => {
      expect(routePartnerModel(intent(action), MODELS)).toBe('claude-default')
    }
  )

  it.each<IntentAction>(['draft', 'parse'])(
    'routes %s to the research model',
    (action) => {
      expect(routePartnerModel(intent(action), MODELS)).toBe('claude-research')
    }
  )

  it('falls back to the default model for an unlisted action', () => {
    expect(routePartnerModel(intent('ocr'), MODELS)).toBe('claude-default')
    expect(routePartnerModel(intent('send'), MODELS)).toBe('claude-default')
  })
})
