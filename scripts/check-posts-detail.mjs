import { createClient } from '@sanity/client'

const client = createClient({
  projectId: 'xefjjue7',
  dataset: 'production',
  apiVersion: '2024-01-01',
  useCdn: false,
})

async function checkPosts() {
  const query = `*[_type == "post"] | order(featured desc, publishedAt desc) {
    _id,
    title,
    slug,
    excerpt,
    mainImage,
    category,
    featured,
    publishedAt
  }`

  const posts = await client.fetch(query)

  console.log('Posts returned by blog page query:\n')
  posts.forEach((post, i) => {
    console.log(`${i + 1}. ${post.title}`)
    console.log(`   Slug: ${post.slug?.current || 'MISSING'}`)
    console.log(`   Featured: ${post.featured}`)
    console.log(`   Category: ${post.category}`)
    console.log(`   Has mainImage: ${!!post.mainImage}`)
    console.log(`   Has excerpt: ${!!post.excerpt}`)
    console.log(`   Published: ${post.publishedAt}`)
    console.log('')
  })

  console.log(`Total: ${posts.length} posts`)
}

checkPosts()
