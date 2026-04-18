import Button from '@/components/ui/Button'
import LineCTAButton from '@/components/ui/LineCTAButton'

// Default values
const defaults = {
  title: '讓爸媽幫你規劃親子行程',
  description: '聊聊你的想法，我們幫你安排最適合小孩的清邁旅程',
  primaryCta: { text: 'LINE 聊聊行程', link: 'https://line.me/R/ti/p/@037nyuwk' },
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
          <LineCTAButton location="CTA Section" variant="secondary">
            {primaryCta?.text || defaults.primaryCta.text}
          </LineCTAButton>
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
