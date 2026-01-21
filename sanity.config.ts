import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './src/sanity/schemas'
import { projectId, dataset } from './src/sanity/config'
import { structure } from './src/sanity/structure'
import { exportPdfAction } from './src/sanity/actions/exportPdfAction'
import { exportExcelAction } from './src/sanity/actions/exportExcelAction'
import { exportTextAction } from './src/sanity/actions/exportTextAction'
import { duplicateItineraryAction } from './src/sanity/actions/duplicateItineraryAction'
import { syncFromTextAction } from './src/sanity/actions/syncFromTextAction'

export default defineConfig({
  name: 'chiangway-travel',
  title: '清微旅行 CMS',
  projectId,
  dataset,
  basePath: '/studio',
  plugins: [structureTool({ structure })],
  schema: { types: schemaTypes },
  document: {
    actions: (prev, context) => {
      // 在 itinerary 類型加入自訂 actions
      if (context.schemaType === 'itinerary') {
        return [
          ...prev,
          syncFromTextAction,    // 編輯行程文字（更新行程用）
          duplicateItineraryAction, // 複製行程
          exportTextAction,      // 匯出 LINE 文字
          exportPdfAction,       // 匯出 PDF
          exportExcelAction,     // 匯出 Excel
        ]
      }
      return prev
    },
  },
})
