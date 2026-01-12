import type { Metadata } from 'next'
import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export const metadata: Metadata = {
  title: '行程介紹',
  description: '清微旅行提供多種清邁親子行程，包括大象保育園、叢林飛索、夜間動物園等熱門景點。',
}

const tours = [
  {
    title: '大象保育園一日遊',
    description: '親近大象、餵食、泥巴浴，讓孩子學習尊重動物的最佳體驗',
    duration: '一日遊',
    highlights: ['餵食大象', '幫大象洗澡', '認識大象保育'],
  },
  {
    title: '清邁古城文化巡禮',
    description: '走訪清邁必去寺廟，體驗泰北蘭納文化之美',
    duration: '半日遊',
    highlights: ['柴迪隆寺', '帕辛寺', '清曼寺'],
  },
  {
    title: '茵他儂國家公園',
    description: '泰國最高峰，涼爽宜人的自然生態之旅',
    duration: '一日遊',
    highlights: ['皇家雙塔', '瀑布健行', '原住民市集'],
  },
  {
    title: '清萊一日遊',
    description: '白廟、藍廟、黑屋博物館，清萊藝術建築之旅',
    duration: '一日遊',
    highlights: ['白廟', '藍廟', '黑屋博物館'],
  },
  {
    title: '夜間動物園',
    description: '亞洲最大夜間動物園，近距離接觸動物的奇妙夜晚',
    duration: '半日遊',
    highlights: ['夜間遊園車', '動物餵食', '水舞燈光秀'],
  },
  {
    title: '客製化行程',
    description: '依照您的需求，量身打造專屬行程',
    duration: '彈性',
    highlights: ['自由安排', '專屬規劃', '在地推薦'],
  },
]

export default function ToursPage() {
  return (
    <div className="py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="行程介紹"
          subtitle="精選親子友善行程，每一趟都是難忘回憶"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {tours.map((tour) => (
            <Card key={tour.title} className="flex flex-col">
              <div className="h-48 bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                <span className="text-6xl">🌴</span>
              </div>
              <div className="p-6 flex-grow flex flex-col">
                <span className="text-sm text-primary font-medium mb-2">{tour.duration}</span>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{tour.title}</h3>
                <p className="text-gray-600 mb-4 flex-grow">{tour.description}</p>
                <div className="flex flex-wrap gap-2">
                  {tour.highlights.map((h) => (
                    <span key={h} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="text-center bg-gray-50 rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">想了解更多行程細節？</h3>
          <p className="text-gray-600 mb-6">免費諮詢，我們會根據您的需求推薦最適合的行程</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button href="https://line.me/R/ti/p/@037nyuwk" external>
              LINE 諮詢
            </Button>
            <Button href="https://chiangway-travel.rezio.shop" external variant="outline">
              Rezio 線上預訂
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
