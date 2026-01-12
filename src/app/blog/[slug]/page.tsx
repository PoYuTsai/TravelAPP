import type { Metadata } from 'next'
import Link from 'next/link'
import Button from '@/components/ui/Button'

// 暫時使用靜態資料
const posts: Record<string, { title: string; content: string; date: string; category: string }> = {
  'chiang-mai-family-travel-guide': {
    title: '2024清邁親子自由行完整攻略',
    content: `
      <h2>為什麼選擇清邁親子旅遊？</h2>
      <p>清邁是泰國第二大城市，相較於曼谷的繁忙，清邁步調悠閒、物價親民，非常適合帶著孩子慢慢玩。這裡有豐富的自然景觀、有趣的動物園、道地的泰北文化，絕對是親子旅遊的絕佳選擇。</p>

      <h2>最佳旅遊季節</h2>
      <p>11月到2月是清邁的涼季，氣候舒適宜人，是最適合旅遊的季節。3-5月天氣炎熱，6-10月是雨季，但雨通常來得快去得也快，不會影響太多行程。</p>

      <h2>親子住宿推薦</h2>
      <p>建議選擇尼曼區或古城區的飯店，交通便利、生活機能好。如果預算充足，可以考慮有泳池的度假村，讓孩子有地方放電。</p>

      <h2>必去親子景點</h2>
      <ul>
        <li>大象保育園 - 近距離接觸大象</li>
        <li>清邁夜間動物園 - 亞洲最大夜間動物園</li>
        <li>豬豬農場 - 可愛動物互動</li>
        <li>叢林飛索 - 適合大孩子的冒險活動</li>
      </ul>
    `,
    date: '2024-01-15',
    category: '攻略',
  },
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = posts[params.slug]
  return {
    title: post?.title || '文章',
    description: post?.title || '清邁旅遊文章',
  }
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = posts[params.slug]

  if (!post) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">文章不存在</h1>
        <Button href="/blog">返回部落格</Button>
      </div>
    )
  }

  return (
    <article className="py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link href="/blog" className="text-primary hover:underline mb-8 inline-block">
          ← 返回部落格
        </Link>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm bg-primary/20 text-primary-dark px-3 py-1 rounded-full">
            {post.category}
          </span>
          <span className="text-sm text-gray-400">{post.date}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8">{post.title}</h1>

        <div
          className="prose prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        <div className="mt-12 p-6 bg-primary-light rounded-xl text-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">需要行程規劃協助嗎？</h3>
          <p className="text-gray-600 mb-4">免費諮詢，讓我們為您規劃完美的清邁親子之旅</p>
          <Button href="https://line.me/R/ti/p/@037nyuwk" external>
            LINE 諮詢
          </Button>
        </div>
      </div>
    </article>
  )
}
