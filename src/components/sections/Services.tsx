import Image from 'next/image'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'
import { urlFor } from '@/sanity/client'
import type { SanityImageSource } from '@sanity/image-url'

interface ServiceItem {
  image?: { asset: SanityImageSource; alt?: string }
  title: string
  subtitle?: string
  features: string[]
  price?: string
  ctaText: string
  ctaLink: string
}

// Default values
const defaultServices: ServiceItem[] = [
  {
    title: '親子包車服務',
    features: [
      '專屬司機 + 中文導遊',
      '兒童安全座椅',
      '行程彈性不趕路',
      '接機 / 送機服務',
    ],
    price: '每日 NT$ 3,700 起',
    ctaText: '了解包車服務',
    ctaLink: '/services/car-charter',
  },
  {
    title: '芳縣特色民宿',
    subtitle: 'Huen San Fang Hotel',
    features: [
      '遠離觀光區的寧靜',
      '體驗泰北在地生活',
      '適合長住深度旅遊',
      '民宿主人親自接待',
    ],
    ctaText: '了解民宿',
    ctaLink: '/homestay',
  },
]

interface ServicesProps {
  sectionTitle?: string
  sectionSubtitle?: string
  items?: ServiceItem[]
}

export default function Services({
  sectionTitle = '我們的服務',
  sectionSubtitle = '包車 + 住宿，一站式親子旅遊體驗',
  items,
}: ServicesProps) {
  const services = items && items.length > 0 ? items : defaultServices

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle title={sectionTitle} subtitle={sectionSubtitle} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              {/* Image */}
              <div className="relative h-48 md:h-56 bg-gradient-to-br from-primary-light to-primary/30">
                {service.image?.asset ? (
                  <Image
                    src={urlFor(service.image.asset).width(600).height(400).url()}
                    alt={service.image.alt || service.title}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-6xl">
                      {service.title.includes('包車') ? '🚐' : '🏠'}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {service.title}
                </h3>
                {service.subtitle && (
                  <p className="text-sm text-gray-500 mb-4">{service.subtitle}</p>
                )}
                <ul className="space-y-2 mb-4">
                  {service.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2 text-gray-600">
                      <span className="text-primary mt-0.5">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                {service.price && (
                  <p className="text-lg font-bold text-primary mb-4">
                    {service.price}
                  </p>
                )}
                <Button href={service.ctaLink} variant="outline" className="w-full">
                  {service.ctaText}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
