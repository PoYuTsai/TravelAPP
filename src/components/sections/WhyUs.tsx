import SectionTitle from '@/components/ui/SectionTitle'

const reasons = [
  {
    icon: '🏠',
    title: '在地家庭經營',
    description: '不是旅行社，是住在清邁的真實家庭。台灣爸爸 + 泰國媽媽，給您最真實的在地體驗。',
  },
  {
    icon: '👶',
    title: '自己也是爸媽',
    description: '我們有女兒，懂帶小孩出遊的眉角。行程節奏、休息時間、用餐地點，都從爸媽角度思考。',
  },
  {
    icon: '🚐',
    title: '司機導遊分工',
    description: '專業分工，司機專心開車，導遊專心服務。不是中文司機一人包辦，服務品質更好。',
  },
  {
    icon: '✨',
    title: '客製化行程',
    description: '根據孩子年齡、體力量身打造。不跑固定路線，不趕行程，玩得輕鬆才是真的玩。',
  },
]

export default function WhyUs() {
  return (
    <section className="py-16 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="為什麼選擇清微旅行"
          subtitle="不只是包車，更是您在清邁的家人"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reasons.map((reason) => (
            <div
              key={reason.title}
              className="flex gap-4 p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="text-4xl flex-shrink-0">{reason.icon}</div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  {reason.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {reason.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
