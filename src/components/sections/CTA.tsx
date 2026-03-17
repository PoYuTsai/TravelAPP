import Button from '@/components/ui/Button'
import LineCTAButton from '@/components/ui/LineCTAButton'
import { defaultSiteSettings } from '@/lib/site-settings'

const defaults = {
  eyebrow: '把旅行方向先抓順',
  title: '想開始安排清邁旅程，現在就可以先聊',
  description: '先告訴我們日期、旅伴和大方向，我們會一起把節奏和玩法收斂得更清楚。',
  helperText: '不用先準備一大份需求表，只要先把日期與大方向丟來，我們就能一起收斂。',
  planningTitle: '你會先得到這些',
  planningSteps: ['先確認日期、人數與大方向', '一起收斂適合家庭的節奏與路線', '再決定包車、行程或住宿安排'],
  responseTitle: '通常回覆時間',
  responseDescription: '一般約 2 小時內回覆。如果剛好在帶團，也會盡快補上建議方向。',
  primaryCta: { text: 'LINE 詢問清邁安排', link: defaultSiteSettings.socialLinks.line },
  secondaryCta: { text: '先看包車服務', link: '/services/car-charter' },
}

interface CTAProps {
  eyebrow?: string
  title?: string
  description?: string
  helperText?: string
  planningTitle?: string
  planningSteps?: string[]
  responseTitle?: string
  responseDescription?: string
  primaryCta?: { text?: string; link?: string }
  secondaryCta?: { text?: string; link?: string }
}

export default function CTA({
  eyebrow = defaults.eyebrow,
  title = defaults.title,
  description = defaults.description,
  helperText = defaults.helperText,
  planningTitle = defaults.planningTitle,
  planningSteps = defaults.planningSteps,
  responseTitle = defaults.responseTitle,
  responseDescription = defaults.responseDescription,
  primaryCta,
  secondaryCta,
}: CTAProps) {
  const activePlanningSteps = (planningSteps || defaults.planningSteps).filter(Boolean).slice(0, 4)
  const primaryLink = primaryCta?.link || defaults.primaryCta.link
  const secondaryLink = secondaryCta?.link || defaults.secondaryCta.link
  const primaryIsLine = primaryLink.includes('line.me')

  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      <div className="absolute inset-0 bg-gradient-to-br from-stone-950 via-[#4b3814] to-[#9f791a]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(247,192,9,0.24),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.12),transparent_24%)]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 rounded-[32px] border border-white/12 bg-white/10 p-8 shadow-[0_34px_90px_-40px_rgba(0,0,0,0.6)] backdrop-blur-xl md:p-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-light/90">
              {eyebrow}
            </p>
            <h2 className="mt-4 text-3xl font-bold text-white md:text-5xl">{title}</h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80 md:text-xl">
              {description}
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              {primaryIsLine ? (
                <LineCTAButton
                  location="CTA Section"
                  className="shadow-[0_20px_45px_-20px_rgba(247,192,9,0.85)]"
                >
                  {primaryCta?.text || defaults.primaryCta.text}
                </LineCTAButton>
              ) : (
                <Button
                  href={primaryLink}
                  external={primaryLink.startsWith('http')}
                  size="lg"
                  className="shadow-[0_20px_45px_-20px_rgba(247,192,9,0.85)]"
                >
                  {primaryCta?.text || defaults.primaryCta.text}
                </Button>
              )}
              <Button
                href={secondaryLink}
                external={secondaryLink.startsWith('http')}
                variant="outline"
                size="lg"
                className="border-white/35 text-white hover:border-white hover:bg-white hover:text-stone-900"
              >
                {secondaryCta?.text || defaults.secondaryCta.text}
              </Button>
            </div>

            <p className="mt-5 text-sm leading-6 text-white/65 md:text-base">{helperText}</p>
          </div>

          <div className="rounded-[28px] bg-white/95 p-6 text-left shadow-[0_20px_60px_-36px_rgba(0,0,0,0.45)]">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-500">
              {planningTitle}
            </p>
            <div className="mt-5 space-y-3">
              {activePlanningSteps.map((step, index) => (
                <div key={step} className="flex items-start gap-3 rounded-2xl bg-stone-100 px-4 py-3">
                  <span className="mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-stone-900 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-6 text-stone-700">{step}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl bg-primary-light px-4 py-4">
              <p className="text-sm font-semibold text-stone-900">{responseTitle}</p>
              <p className="mt-1 text-sm leading-6 text-stone-700">{responseDescription}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
