const stats = [
  { value: '110+', label: '服務家庭' },
  { value: '⭐⭐⭐⭐⭐', label: 'Google 五星好評' },
  { value: '2024', label: '創立年份' },
]

export default function TrustNumbers() {
  return (
    <section className="py-8 bg-gray-50 border-y border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
          {stats.map((stat) => (
            <a
              key={stat.label}
              href={stat.label === 'Google 五星好評' ? 'https://g.co/kgs/1bUJyoG' : undefined}
              target={stat.label === 'Google 五星好評' ? '_blank' : undefined}
              rel={stat.label === 'Google 五星好評' ? 'noopener noreferrer' : undefined}
              className={`text-center ${stat.label === 'Google 五星好評' ? 'hover:opacity-80 cursor-pointer' : ''}`}
            >
              <div className="text-2xl md:text-3xl font-bold text-gray-900">
                {stat.value}
              </div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  )
}
