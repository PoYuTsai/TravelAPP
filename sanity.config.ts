import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './src/sanity/schemas'
import { projectId, dataset } from './src/sanity/config'
import { structure } from './src/sanity/structure'

export default defineConfig({
  name: 'chiangway-travel',
  title: '清微旅行 CMS',
  projectId,
  dataset,
  basePath: '/studio',
  plugins: [structureTool({ structure })],
  schema: { types: schemaTypes },
})
