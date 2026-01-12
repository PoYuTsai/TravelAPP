import type { Metadata } from 'next'
import Link from 'next/link'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'

export const metadata: Metadata = {
  title: '部落格',
  description: '清邁旅遊攻略、親子景點推薦、在地美食分享，讓您的清邁之旅更精彩。',
}

// 暫時使用靜態資料，之後會從 Sanity CMS 取得
const posts = [
  {
    slug: 'chiang-mai-family-travel-guide',
    title: '2024清邁親子自由行完整攻略',
    excerpt: '從機票、住宿到行程規劃，一篇搞定清邁親子旅遊所有大小事',
    date: '2024-01-15',
    category: '攻略',
  },
  {
    slug: 'chiang-mai-kids-attractions',
    title: '清邁親子景點TOP 10推薦',
    excerpt: '精選適合帶小孩去的清邁景點，大人小孩都玩得開心',
    date: '2024-01-10',
    category: '景點',
  },
  {
    slug: 'chiang-mai-family-restaurants',
    title: '清邁親子友善餐廳推薦',
    excerpt: '有兒童座椅、遊戲區的清邁餐廳，讓爸媽也能好好吃飯',
    date: '2024-01-05',
    category: '美食',
  },
]

export default function BlogPage() {
  return (
    <div className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="部落格"
          subtitle="清邁旅遊資訊、親子攻略、在地推薦"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {posts.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`}>
              <Card className="h-full hover:shadow-xl transition-shadow">
                <div className="h-48 bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                  <span className="text-6xl">📝</span>
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-primary/20 text-primary-dark px-2 py-1 rounded-full">
                      {post.category}
                    </span>
                    <span className="text-xs text-gray-400">{post.date}</span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{post.title}</h3>
                  <p className="text-gray-600">{post.excerpt}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <div className="text-center mt-12 text-gray-500">
          <p>更多文章持續更新中...</p>
        </div>
      </div>
    </div>
  )
}
