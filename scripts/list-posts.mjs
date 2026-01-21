import { createClient } from '@sanity/client'

const client = createClient({
  projectId: 'xefjjue7',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
})

async function listPosts() {
  const posts = await client.fetch(`*[_type == "post"] {
    _id,
    title,
    slug,
    category,
    publishedAt,
    _createdAt
  } | order(publishedAt desc)`)

  console.log('All posts in Sanity:\n')
  posts.forEach((post, i) => {
    console.log(`${i + 1}. ${post.title}`)
    console.log(`   ID: ${post._id}`)
    console.log(`   Slug: ${post.slug?.current || 'NO SLUG'}`)
    console.log(`   Category: ${post.category || 'NO CATEGORY'}`)
    console.log(`   Published: ${post.publishedAt || 'NOT SET'}`)
    console.log('')
  })
}

listPosts()
