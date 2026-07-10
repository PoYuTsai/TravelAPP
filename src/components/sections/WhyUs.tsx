import SectionTitle from '@/components/ui/SectionTitle'

// Default values
const defaultReasons = [
  {
    icon: '🚐',
    title: '標準泰國司機',
    description: '標準服務由泰國司機專心駕駛，通常不以中文服務；行程會在出發前確認。',
  },
  {
    icon: '💬',
    title: 'LINE 中文支援',
    description: '行前先把路線與節奏排好，旅途中需要協助時可透過 LINE 中文支援聯繫。',
  },
  {
    icon: '🧭',
    title: '中文導遊依需求選配',
    description: '需要隨車中文溝通或景點導覽時再選配中文導遊；不是中文司機一人包辦。',
  },
  {
    icon: '🏠',
    title: '在地家庭經營',
    description: '台灣爸爸與泰國媽媽在地協助，依孩子年齡、體力與家庭節奏安排路線。',
  },
]

interface Reason {
  icon?: string
  title: string
  description: string
}

interface WhyUsProps {
  sectionTitle?: string
  sectionSubtitle?: string
  reasons?: Reason[]
}

export default function WhyUs({
  sectionTitle = '為什麼選擇清微旅行',
  sectionSubtitle = '服務內容先說清楚，再依你們家的需求安排',
  reasons,
}: WhyUsProps) {
  const items = reasons && reasons.length > 0 ? reasons : defaultReasons

  return (
    <section className="py-16 md:py-20 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle title={sectionTitle} subtitle={sectionSubtitle} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {items.map((reason, index) => (
            <div
              key={index}
              className="flex gap-4 p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow"
            >
              {reason.icon && (
                <div className="text-4xl flex-shrink-0">{reason.icon}</div>
              )}
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
