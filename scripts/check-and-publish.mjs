import { createClient } from '@sanity/client'

const client = createClient({
  projectId: 'xefjjue7',
  dataset: 'production',
  apiVersion: '2024-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
})

const documentId = 'BU6a4jQyI1BbfpIHWqt5Z7'

async function checkAndPublish() {
  // Check if there's a draft
  const draftId = `drafts.${documentId}`

  console.log('Checking document status...')

  const draft = await client.getDocument(draftId)
  const published = await client.getDocument(documentId)

  if (draft) {
    console.log('Found draft version - publishing now...')

    // Publish by copying draft to published
    const result = await client
      .transaction()
      .createOrReplace({
        ...draft,
        _id: documentId,
      })
      .delete(draftId)
      .commit()

    console.log('Published successfully!')
  } else {
    console.log('No draft found. Document status:')
    console.log('- Published exists:', !!published)

    if (published) {
      // Check if body contains the updated text
      const bodyText = JSON.stringify(published.body)
      const has泰銖 = bodyText.includes('泰銖')
      const has過渡句 = bodyText.includes('如果你是來清邁旅遊的家庭')

      console.log('- Contains 泰銖:', has泰銖)
      console.log('- Contains 過渡句:', has過渡句)
    }
  }
}

checkAndPublish()
