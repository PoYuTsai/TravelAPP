import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'

import { exportExcelAction } from './src/sanity/actions/exportExcelAction'
import { exportPdfAction } from './src/sanity/actions/exportPdfAction'
import { exportTextAction } from './src/sanity/actions/exportTextAction'
import { expireQuotePaymentAction } from './src/sanity/actions/expireQuotePaymentAction'
import { openQuotePageAction } from './src/sanity/actions/openQuotePageAction'
import { prepareQuotePaymentAction } from './src/sanity/actions/prepareQuotePaymentAction'
import { syncFromTextAction } from './src/sanity/actions/syncFromTextAction'
import { projectId, dataset } from './src/sanity/config'
import { schemaTypes } from './src/sanity/schemas'
import { structure } from './src/sanity/structure'
import { customizeStudioTools } from './src/sanity/studio-access'
import { accountingTool } from './src/sanity/tools/accounting'
import { dashboardTool } from './src/sanity/tools/dashboard'
import { formalPricingTool, pricingTool } from './src/sanity/tools/pricing'

export default defineConfig({
  name: 'chiangway-travel',
  title: 'Chiangway Travel CMS',
  projectId,
  dataset,
  basePath: '/studio',
  auth: {
    loginMethod: 'token',
  },
  plugins: [
    structureTool({ structure }),
    dashboardTool(),
    accountingTool(),
    pricingTool(),
    formalPricingTool(),
  ],
  tools: (prev, { currentUser }) => customizeStudioTools(prev, currentUser?.email),
  schema: { types: schemaTypes },
  document: {
    actions: (prev, context) => {
      if (context.schemaType === 'itinerary') {
        return [
          ...prev,
          syncFromTextAction,
          exportTextAction,
          exportPdfAction,
          exportExcelAction,
        ]
      }

      if (context.schemaType === 'pricingExample') {
        return [
          openQuotePageAction,
          prepareQuotePaymentAction,
          expireQuotePaymentAction,
          ...prev,
        ]
      }

      return prev
    },
  },
})
