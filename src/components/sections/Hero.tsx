import Image from 'next/image'
import type { SanityImageSource } from '@sanity/image-url'
import Button from '@/components/ui/Button'
import LineCTAButton from '@/components/ui/LineCTAButton'
import { defaultSiteSettings } from '@/lib/site-settings'
import { urlFor } from '@/sanity/client'

const blurDataURL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAIAAoDASIAAhEBAxEB/8QAFgABAQEAAAAAAAAAAAAAAAAAAAUH/8QAIhAAAgEDBAMBAAAAAAAAAAAAAQIDAAQRBQYSIRMxQWH/xAAVAQEBAAAAAAAAAAAAAAAAAAAAAf/EABYRAQEBAAAAAAAAAAAAAAAAAAABEf/aAAwDAQACEQMRAD8AotuXM19qN5cXEhmWOdkjQnpFXrgA/PtZpSlIr//Z'

const defaults = {
  eyebrow: 'Chiangway Travel in Chiang Mai',
  title: '清邁親子包車，由住在清邁的 Eric & Min 協助安排',
  subtitle: '司機與中文導遊分工，幫家庭旅客把行程節奏先安排順',
  description:
    '我們不是只提供一台車，而是從住宿位置、旅伴組成到移動節奏，一起幫你把清邁旅程排得更舒服。',
  proofItems: ['住在清邁的台灣家庭', '司機與中文導遊分工', '以親子與家庭旅伴為核心設計'],
  helperText: '先把日期、人數、孩子年齡或想去的點傳來，我們會先幫你看怎麼排比較順。',
  panelEyebrow: '家庭旅行先想前面',
  panelTitle: '不是只把車叫來\n而是把旅程節奏先順好',
  panelDescription:
    '我們會先看住宿位置、旅伴組合與移動距離，讓親子旅行不是一直趕，而是更穩地往前走。',
  primaryCta: { text: 'LINE 詢問清邁安排', link: defaultSiteSettings.socialLinks.line },
  secondaryCta: { text: '看行程案例', link: '/tours' },
}

interface HeroProps {
  backgroundImage?: { asset: SanityImageSource; alt?: string }
  eyebrow?: string
  title?: string
  subtitle?: string
  description?: string
  proofItems?: string[]
  helperText?: string
  panelEyebrow?: string
  panelTitle?: string
  panelDescription?: string
  primaryCta?: { text?: string; link?: string }
  secondaryCta?: { text?: string; link?: string }
  familyCountValue?: number
  reviewCount?: number
  ratingValue?: number
}

export default function Hero({
  backgroundImage,
  eyebrow = defaults.eyebrow,
  title = defaults.title,
  subtitle = defaults.subtitle,
  description = defaults.description,
  proofItems = defaults.proofItems,
  helperText = defaults.helperText,
  panelEyebrow = defaults.panelEyebrow,
  panelTitle = defaults.panelTitle,
  panelDescription = defaults.panelDescription,
  primaryCta,
  secondaryCta,
  familyCountValue = 114,
  reviewCount = 110,
  ratingValue = 5,
}: HeroProps) {
  const heroImageSrc = backgroundImage?.asset
    ? urlFor(backgroundImage.asset).width(1920).height(960).url()
    : '/images/hero-bg.webp'
  const primaryLink = primaryCta?.link || defaults.primaryCta.link
  const secondaryLink = secondaryCta?.link || defaults.secondaryCta.link
  const primaryIsLine = primaryLink.includes('line.me')
  const secondaryIsExternal = secondaryLink.startsWith('http')

  const mobileStats = [
    { value: `${familyCountValue}+`, label: '服務家庭' },
    { value: `${ratingValue.toFixed(1)}`, label: 'Google 評分' },
    { value: `${reviewCount}+`, label: '旅客回饋' },
  ]

  const activeProofItems = (proofItems || defaults.proofItems).filter(Boolean).slice(0, 4)

  return (
    <section className="relative overflow-hidden bg-stone-950">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,192,9,0.28),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_30%)]" />

      <div className="relative min-h-[580px] md:min-h-[720px]">
        <Image
          src={heroImageSrc}
          alt={backgroundImage?.alt || '清微旅行 - 清邁親子包車'}
          fill
          sizes="100vw"
          className="scale-[1.02] object-cover object-center"
          priority
          placeholder="blur"
          blurDataURL={blurDataURL}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-stone-950/90 via-stone-950/65 to-stone-950/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/10 to-transparent" />

        <div className="relative z-10 mx-auto flex h-full max-w-7xl items-end px-4 py-16 sm:px-6 md:py-24 lg:px-8 lg:py-28">
          <div className="grid w-full items-end gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {eyebrow}
              </div>

              <h1 className="mt-6 text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
                {title}
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-medium leading-relaxed text-primary-light md:text-2xl">
                {subtitle}
              </p>
              <p className="mt-4 max-w-2xl text-base leading-7 text-white/78 md:text-lg">
                {description}
              </p>

              {activeProofItems.length > 0 && (
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {activeProofItems.map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-white/15 bg-black/20 px-3 py-2 text-sm text-white/85 backdrop-blur-sm"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-8 flex flex-col gap-4 sm:flex-row">
                {primaryIsLine ? (
                  <LineCTAButton
                    location="Hero - Primary CTA"
                    className="shadow-[0_18px_45px_-18px_rgba(247,192,9,0.9)]"
                  >
                    {primaryCta?.text || defaults.primaryCta.text}
                  </LineCTAButton>
                ) : (
                  <Button
                    href={primaryLink}
                    external={primaryLink.startsWith('http')}
                    size="lg"
                    className="shadow-[0_18px_45px_-18px_rgba(247,192,9,0.9)]"
                  >
                    {primaryCta?.text || defaults.primaryCta.text}
                  </Button>
                )}
                <Button
                  href={secondaryLink}
                  external={secondaryIsExternal}
                  variant="outline"
                  size="lg"
                  className="border-white/35 text-white hover:border-white hover:bg-white hover:text-stone-900"
                >
                  {secondaryCta?.text || defaults.secondaryCta.text}
                </Button>
              </div>

              <p className="mt-5 text-sm text-white/65 md:text-base">{helperText}</p>
            </div>

            <div className="hidden lg:block">
              <div className="rounded-[28px] border border-white/15 bg-white/92 p-6 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)] backdrop-blur-md">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                  {panelEyebrow}
                </p>
                <h2 className="mt-3 whitespace-pre-line text-2xl font-bold leading-tight text-stone-900">
                  {panelTitle}
                </h2>

                <div className="mt-6 space-y-3">
                  <div className="rounded-2xl bg-amber-50 px-4 py-4">
                    <p className="text-3xl font-bold text-stone-900">{familyCountValue}+</p>
                    <p className="mt-1 text-sm text-stone-600">已服務家庭</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-stone-100 px-4 py-4">
                      <p className="text-2xl font-bold text-stone-900">{ratingValue.toFixed(1)}</p>
                      <p className="mt-1 text-sm text-stone-600">Google 評分</p>
                    </div>
                    <div className="rounded-2xl bg-stone-100 px-4 py-4">
                      <p className="text-2xl font-bold text-stone-900">{reviewCount}+</p>
                      <p className="mt-1 text-sm text-stone-600">旅客回饋</p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl bg-stone-900 px-4 py-4 text-sm leading-6 text-white/82">
                  {panelDescription}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 px-4 pb-8 sm:px-6 lg:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-3 gap-3 rounded-[28px] border border-white/10 bg-white/92 p-4 shadow-[0_24px_70px_-28px_rgba(0,0,0,0.45)] backdrop-blur-md">
          {mobileStats.map((item) => (
            <div key={item.label} className="rounded-2xl bg-stone-100 px-3 py-4 text-center">
              <p className="text-2xl font-bold text-stone-900">{item.value}</p>
              <p className="mt-1 text-xs leading-5 text-stone-600">{item.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
