import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { createClient } from 'next-sanity'
import { apiVersion, dataset, projectId } from '../src/sanity/config'

interface LearningConversationImportRow {
  _id?: string
  lineUserId: string
  customerName: string
  conversationStatus: string
  sourceConversationId: string
  inquirySummary?: string
  messages?: Array<{
    role: string
    content: string
    timestamp: string
  }>
  createdAt: string
}

async function main() {
  const inputPath = process.argv[2]
  const token = process.env.SANITY_API_WRITE_TOKEN

  if (!inputPath) {
    throw new Error('Usage: tsx scripts/import-learning-conversations.ts <path-to-json>')
  }

  if (!token) {
    throw new Error('Missing SANITY_API_WRITE_TOKEN')
  }

  const absolutePath = resolve(process.cwd(), inputPath)
  const raw = await readFile(absolutePath, 'utf8')
  const records = JSON.parse(raw) as LearningConversationImportRow[]

  const client = createClient({
    projectId,
    dataset,
    apiVersion,
    useCdn: false,
    token,
  })

  for (const record of records) {
    await client.createOrReplace({
      _id: record._id ?? `learningConversation.${record.sourceConversationId}`,
      _type: 'learningConversation',
      ...record,
    })
  }

  console.log(`Imported ${records.length} learningConversation records from ${absolutePath}`)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
