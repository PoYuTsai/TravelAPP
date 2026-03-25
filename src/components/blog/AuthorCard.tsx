import Image from 'next/image'
import Link from 'next/link'

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
        <p className="font-medium text-gray-900">
          <Link href="/" className="hover:underline">
            Eric & Min｜清微旅行
          </Link>
        </p>
        <p className="text-sm text-gray-600">
          清微旅行 Chiangway Travel 創辦人，住在清邁的台泰夫妻，專做清邁親子包車與親子旅遊規劃。
        </p>
      </div>
    </div>
  )
}
