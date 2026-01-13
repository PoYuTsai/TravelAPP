import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'

const services = [
  {
    image: '/images/service-car.jpg',
    title: '親子包車服務',
    features: [
      '專屬司機 + 中文導遊',
      '兒童安全座椅',
      '行程彈性不趕路',
      '接機 / 送機服務',
    ],
    price: '每日 NT$ 3,500 起',
    cta: { text: '了解包車服務', href: '/services/car-charter' },
  },
  {
    image: '/images/service-homestay.jpg',
    title: '芳縣特色民宿',
    subtitle: 'Huen San Fang Hotel',
    features: [
      '遠離觀光區的寧靜',
      '體驗泰北在地生活',
      '適合長住深度旅遊',
      '民宿主人親自接待',
    ],
    cta: { text: '了解民宿', href: '/homestay' },
  },
]

export default function Services() {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="我們的服務"
          subtitle="包車 + 住宿，一站式親子旅遊體驗"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((service) => (
            <div
              key={service.title}
              className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
            >
              {/* Image placeholder */}
              <div className="relative h-48 md:h-56 bg-gradient-to-br from-primary-light to-primary/30 flex items-center justify-center">
                <span className="text-6xl">
                  {service.title.includes('包車') ? '🚐' : '🏠'}
                </span>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-1">
                  {service.title}
                </h3>
                {service.subtitle && (
                  <p className="text-sm text-gray-500 mb-4">{service.subtitle}</p>
                )}
                <ul className="space-y-2 mb-4">
                  {service.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-gray-600">
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
                <Button href={service.cta.href} variant="outline" className="w-full">
                  {service.cta.text}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
