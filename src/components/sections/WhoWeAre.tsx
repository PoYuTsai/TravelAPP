import Link from 'next/link'

export default function WhoWeAre() {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Profile Image Placeholder */}
        <div className="flex justify-center mb-8">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center border-4 border-white shadow-lg">
            <span className="text-4xl">👨‍👩‍👧</span>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
          台灣爸爸 + 泰國媽媽
        </h2>

        {/* Description */}
        <p className="text-base md:text-lg text-gray-600 leading-relaxed mb-6">
          我們是住在清邁的真實家庭，帶著自己的孩子探索這座城市。
          <br className="hidden sm:block" />
          不是旅行社，是用「家人」的心情帶你們玩。
        </p>

        {/* Link to Story */}
        <Link
          href="/blog/eric-story-taiwan-to-chiang-mai"
          className="inline-flex items-center gap-2 text-primary hover:text-primary-dark font-medium transition-colors group"
        >
          閱讀我們的故事
          <svg
            className="w-5 h-5 transform transition-transform group-hover:translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </Link>
      </div>
    </section>
  )
}
