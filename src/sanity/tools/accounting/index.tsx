// src/sanity/tools/accounting/index.tsx

import { definePlugin } from 'sanity'
import { CreditCardIcon } from '@sanity/icons'
import { AccountingTool } from './AccountingTool'

export const accountingTool = definePlugin({
  name: 'accounting-tool',
  tools: [
    {
      name: 'accounting',
      title: '記帳',
      icon: CreditCardIcon,
      component: AccountingTool,
    },
  ],
})
