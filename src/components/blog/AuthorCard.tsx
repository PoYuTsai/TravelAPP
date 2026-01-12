import Image from 'next/image'

export default function AuthorCard() {
  return (
    <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
      <Image
        src="/images/eric-min.jpg"
        alt="Eric 與 Min - 清微旅行創辦人"
        width={64}
        height={64}
        className="w-16 h-16 rounded-full object-cover"
      />
      <div>
        <p className="font-medium text-gray-900">Eric & Min</p>
        <p className="text-sm text-gray-600">
          清微旅行創辦人，住在清邁的台泰夫妻，專營親子包車旅遊服務
        </p>
      </div>
    </div>
  )
}
