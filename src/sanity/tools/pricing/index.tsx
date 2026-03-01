// src/sanity/tools/pricing/index.tsx

import { definePlugin } from 'sanity'
import { DocumentsIcon } from '@sanity/icons'
import { PricingCalculator } from './PricingCalculator'

export const pricingTool = definePlugin({
  name: 'pricing-tool',
  tools: [
    {
      name: 'pricing',
      title: '報價計算',
      icon: DocumentsIcon,
      component: PricingCalculator,
    },
  ],
})
