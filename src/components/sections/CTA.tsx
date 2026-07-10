import Button from '@/components/ui/Button'
import LineCTAButton from '@/components/ui/LineCTAButton'
import { HOME_PUBLIC_COPY } from '@/lib/home-public-copy'

export default function CTA() {
  return (
    <section className="py-16 md:py-20 bg-primary">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-2xl md:text-4xl font-bold text-gray-900 mb-4">
          {HOME_PUBLIC_COPY.cta.title}
        </h2>
        <p className="text-lg md:text-xl text-gray-800 mb-8">
          {HOME_PUBLIC_COPY.cta.description}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <LineCTAButton location="CTA Section" variant="secondary">
            {HOME_PUBLIC_COPY.cta.primaryCta.text}
          </LineCTAButton>
          <Button
            href={HOME_PUBLIC_COPY.cta.secondaryCta.link}
            variant="outline"
            size="lg"
          >
            {HOME_PUBLIC_COPY.cta.secondaryCta.text}
          </Button>
        </div>
      </div>
    </section>
  )
}
