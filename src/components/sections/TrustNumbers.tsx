const stats = [
  { value: '110+', label: '服務家庭', href: null },
  { value: '⭐⭐⭐⭐⭐', label: 'Google 五星好評', href: 'https://g.co/kgs/1bUJyoG' },
  { value: '2024', label: '創立年份', href: null },
]

export default function TrustNumbers() {
  return (
    <section className="py-8 bg-gray-50 border-y border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
          {stats.map((stat) =>
            stat.href ? (
              <a
                key={stat.label}
                href={stat.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center hover:opacity-80 transition-opacity"
              >
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </a>
            ) : (
              <div key={stat.label} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  )
}
