import SectionTitle from '@/components/ui/SectionTitle'
import Card from '@/components/ui/Card'

const services = [
  {
    icon: '🚐',
    title: '專屬包車',
    description: '舒適寬敞的車輛，專業司機接送，行程彈性自由安排',
  },
  {
    icon: '🗣️',
    title: '中文導遊',
    description: '全程中文溝通無障礙，深度了解在地文化與景點故事',
  },
  {
    icon: '👨‍👩‍👧‍👦',
    title: '親子友善',
    description: '專為家庭設計的行程，兒童座椅、彈性休息時間',
  },
  {
    icon: '📋',
    title: '客製行程',
    description: '根據您的需求量身打造，不跟團、不趕路',
  },
]

export default function Services() {
  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="我們的服務"
          subtitle="專業、安心、貼心的清邁旅遊體驗"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service) => (
            <Card key={service.title} className="p-6 text-center hover:shadow-xl transition-shadow">
              <div className="text-5xl mb-4">{service.icon}</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">{service.title}</h3>
              <p className="text-gray-600">{service.description}</p>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
