// src/sanity/tools/pricing/index.tsx

import { DocumentsIcon } from '@sanity/icons'
import { definePlugin } from 'sanity'
import type { ComponentType } from 'react'

import { FormalPricingCalculator, PricingCalculator } from './PricingCalculator'

function createPricingTool(
  pluginName: string,
  toolName: string,
  title: string,
  component: ComponentType<any>
) {
  return definePlugin({
    name: pluginName,
    tools: [
      {
        name: toolName,
        title,
        icon: DocumentsIcon,
        component,
      },
    ],
  })
}

export const pricingTool = createPricingTool(
  'pricing-tool',
  'pricing',
  '報價計算測試v1',
  PricingCalculator
)

export const formalPricingTool = createPricingTool(
  'pricing-formal-tool',
  'pricing-formal',
  '報價計算(正式版)',
  FormalPricingCalculator
)
