import SectionTitle from '@/components/ui/SectionTitle'

const reasons = [
  {
    icon: '🏠',
    title: '在地台泰夫妻',
    description: '我們住在清邁，Eric 來自台灣，Min 是泰國人。結合兩地文化優勢，給您最道地的清邁體驗。',
  },
  {
    icon: '👶',
    title: '親子旅遊專家',
    description: '自己也是爸媽，深知帶小孩出遊的需求。行程節奏適中，備有兒童座椅，讓大人小孩都玩得開心。',
  },
  {
    icon: '💬',
    title: '全程中文服務',
    description: '從諮詢到旅途結束，全程中文溝通。不用擔心語言問題，輕鬆享受旅程。',
  },
  {
    icon: '⭐',
    title: '客製化體驗',
    description: '不是制式行程，而是根據您的興趣、孩子年齡、體力狀況量身打造專屬行程。',
  },
]

export default function WhyUs() {
  return (
    <section className="py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="為什麼選擇清微旅行"
          subtitle="不只是包車，更是您在清邁的家人"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {reasons.map((reason) => (
            <div key={reason.title} className="flex gap-4 p-6 bg-white rounded-xl shadow-sm">
              <div className="text-4xl flex-shrink-0">{reason.icon}</div>
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{reason.title}</h3>
                <p className="text-gray-600 leading-relaxed">{reason.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
