import { createClient } from '@sanity/client'

const client = createClient({
  projectId: 'xefjjue7',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
})

// 查詢所有已發布的文章
const posts = await client.fetch(`
  *[_type == "post"] | order(publishedAt desc) {
    _id,
    title,
    slug,
    category,
    publishedAt,
    excerpt
  }
`)

console.log("=== Sanity CMS 已發布文章 ===\n")
for (let i = 0; i < posts.length; i++) {
  const post = posts[i]
  console.log((i + 1) + ". " + post.title)
  console.log("   Slug: " + (post.slug?.current || 'N/A'))
  console.log("   Category: " + (post.category || 'N/A'))
  console.log("   Published: " + (post.publishedAt || 'N/A'))
  console.log('')
}

console.log("\n總共 " + posts.length + " 篇文章")
