import Link from 'next/link'
import Button from '@/components/ui/Button'

interface Tour {
  title: string
  slug: string
  description: string
}

interface RelatedToursCTAProps {
  tours?: Tour[]
}

const defaultTours: Tour[] = [
  {
    title: '大象保育園一日遊',
    slug: 'elephant-sanctuary',
    description: '近距離與大象互動，餵食、洗澡，適合全家大小',
  },
  {
    title: '清邁夜間動物園',
    slug: 'night-safari',
    description: '亞洲最大夜間動物園，近距離觀察夜行動物',
  },
  {
    title: '客製化包車行程',
    slug: 'custom-tour',
    description: '依照您的需求，量身規劃專屬行程',
  },
]

export default function RelatedToursCTA({ tours = defaultTours }: RelatedToursCTAProps) {
  return (
    <div className="my-12 p-6 bg-gradient-to-br from-primary-light to-primary/10 rounded-2xl">
      <h3 className="text-xl font-bold text-gray-900 mb-2">推薦行程</h3>
      <p className="text-gray-600 mb-6">精選適合親子的清邁行程，專車接送、中文溝通</p>

      <div className="grid gap-4 mb-6">
        {tours.map((tour) => (
          <Link
            key={tour.slug}
            href={`/tours#${tour.slug}`}
            className="block p-4 bg-white rounded-lg hover:shadow-md transition-shadow"
          >
            <h4 className="font-medium text-gray-900">{tour.title}</h4>
            <p className="text-sm text-gray-600">{tour.description}</p>
          </Link>
        ))}
      </div>

      <div className="text-center">
        <Button href="https://line.me/R/ti/p/@037nyuwk" external size="lg">
          LINE 免費諮詢
        </Button>
      </div>
    </div>
  )
}
