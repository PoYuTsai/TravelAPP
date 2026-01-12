import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { schemaTypes } from './src/sanity/schemas'
import { projectId, dataset } from './src/sanity/config'

export default defineConfig({
  name: 'chiangway-travel',
  title: '清微旅行 CMS',
  projectId,
  dataset,
  basePath: '/studio',
  plugins: [structureTool()],
  schema: { types: schemaTypes },
})
