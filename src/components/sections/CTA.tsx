import Button from '@/components/ui/Button'

// Default values
const defaults = {
  title: '準備好帶孩子來清邁了嗎？',
  description: '免費諮詢，讓在地爸媽幫你規劃最適合的親子行程',
  primaryCta: { text: 'LINE 免費諮詢', link: 'https://line.me/R/ti/p/@037nyuwk' },
  secondaryCta: { text: '瀏覽服務內容', link: '/services/car-charter' },
}

interface CTAProps {
  title?: string
  description?: string
  primaryCta?: { text?: string; link?: string }
  secondaryCta?: { text?: string; link?: string }
}

export default function CTA({
  title = defaults.title,
  description = defaults.description,
  primaryCta,
  secondaryCta,
}: CTAProps) {
  return (
    <section className="py-16 md:py-20 bg-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
          {title}
        </h2>
        <p className="text-lg md:text-xl text-gray-800 mb-8">
          {description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            href={primaryCta?.link || defaults.primaryCta.link}
            external={primaryCta?.link?.startsWith('http')}
            variant="secondary"
            size="lg"
          >
            {primaryCta?.text || defaults.primaryCta.text}
          </Button>
          <Button
            href={secondaryCta?.link || defaults.secondaryCta.link}
            variant="outline"
            size="lg"
          >
            {secondaryCta?.text || defaults.secondaryCta.text}
          </Button>
        </div>
      </div>
    </section>
  )
}
