interface TrustNumber {
  value: string
  label: string
  link?: string
}

interface TrustNumbersBarProps {
  items: TrustNumber[]
}

export default function TrustNumbersBar({ items }: TrustNumbersBarProps) {
  if (!items || items.length === 0) return null

  return (
    <section className="py-8 bg-gray-50 border-y border-gray-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
          {items.map((item, index) =>
            item.link ? (
              <a
                key={index}
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-center hover:opacity-80 transition-opacity"
              >
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  {item.value}
                </div>
                <div className="text-sm text-gray-500 mt-1">{item.label}</div>
              </a>
            ) : (
              <div key={index} className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-gray-900">
                  {item.value}
                </div>
                <div className="text-sm text-gray-500 mt-1">{item.label}</div>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  )
}
