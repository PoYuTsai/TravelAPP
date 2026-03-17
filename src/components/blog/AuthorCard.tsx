import Image from 'next/image'
import Button from '@/components/ui/Button'
import LineCTAButton from '@/components/ui/LineCTAButton'
import type { SiteAuthorProfile } from '@/lib/site-settings'

interface AuthorCardProps {
  variant?: 'default' | 'sidebar'
  ratingValue?: number
  reviewCount?: number
  profile?: SiteAuthorProfile
}

const defaultProfile: SiteAuthorProfile = {
  eyebrow: 'About Chiangway',
  imageAlt: 'Eric 與 Min，清微旅行在地家庭團隊',
  name: 'Eric & Min',
  description: '台灣爸爸與泰國媽媽組成的在地家庭，專注協助親子旅客安排清邁包車與客製行程。',
  serviceLabel: '服務方式',
  serviceValue: '司機 + 導遊',
  summary: '文章內容會從親子旅行、交通、景點與在地生活角度出發，幫你把清邁自由行需要的資訊先整理順。',
  primaryCtaText: 'LINE 詢問清邁行程',
  secondaryCtaText: '看行程案例',
}

export default function AuthorCard({
  variant = 'default',
  ratingValue = 5,
  reviewCount = 110,
  profile = defaultProfile,
}: AuthorCardProps) {
  const isSidebar = variant === 'sidebar'

  return (
    <div
      className={`overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.25)] ${
        isSidebar ? 'px-5 py-5' : 'px-6 py-6 md:px-7'
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
        {profile.eyebrow}
      </p>

      <div className={`mt-4 flex ${isSidebar ? 'items-start gap-4' : 'items-center gap-5'}`}>
        <Image
          src="/images/eric-min.jpg"
          alt={profile.imageAlt}
          width={isSidebar ? 68 : 80}
          height={isSidebar ? 68 : 80}
          className={`rounded-full object-cover ${isSidebar ? 'h-[68px] w-[68px]' : 'h-20 w-20'}`}
        />
        <div className="min-w-0">
          <p className="text-lg font-bold text-stone-900">{profile.name}</p>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            {profile.description}
          </p>
        </div>
      </div>

      <div className={`mt-5 grid gap-3 ${isSidebar ? 'grid-cols-2' : 'md:grid-cols-3'}`}>
        <div className="rounded-2xl bg-amber-50 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">Google 評價</p>
          <p className="mt-1 text-xl font-bold text-stone-900">{ratingValue}</p>
        </div>
        <div className="rounded-2xl bg-stone-100 px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">旅客回饋</p>
          <p className="mt-1 text-xl font-bold text-stone-900">{reviewCount}+</p>
        </div>
        {!isSidebar && (
          <div className="rounded-2xl bg-stone-100 px-4 py-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-stone-500">{profile.serviceLabel}</p>
            <p className="mt-1 text-xl font-bold text-stone-900">{profile.serviceValue}</p>
          </div>
        )}
      </div>

      <p className="mt-5 text-sm leading-6 text-stone-600">
        {profile.summary}
      </p>

      <div className={`mt-5 flex ${isSidebar ? 'flex-col gap-3' : 'flex-col gap-3 sm:flex-row'}`}>
        <LineCTAButton
          location={isSidebar ? 'Author Card Sidebar CTA' : 'Author Card CTA'}
          size={isSidebar ? 'md' : 'lg'}
          className={isSidebar ? 'w-full' : ''}
        >
          {profile.primaryCtaText}
        </LineCTAButton>
        <Button
          href="/tours"
          variant="outline"
          size={isSidebar ? 'md' : 'lg'}
          className={isSidebar ? 'w-full' : ''}
        >
          {profile.secondaryCtaText}
        </Button>
      </div>
    </div>
  )
}
