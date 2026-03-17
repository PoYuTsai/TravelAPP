import Link from 'next/link'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import Button from '@/components/ui/Button'

interface RelatedTour {
  _id: string
  _type: 'tourPackage' | 'dayTour'
  title: string
  slug: string
  subtitle?: string
  coverImage?: {
    asset: { _ref: string }
    alt?: string
  }
  duration?: string
  highlights?: string[]
}

interface RelatedToursProps {
  currentSlug: string
  currentType: 'tourPackage' | 'dayTour'
}

async function getRelatedTours(currentSlug: string, currentType: string): Promise<RelatedTour[]> {
  const query = `{
    "sameType": *[
      (_type == "tourPackage" || _type == "dayTour") &&
      slug.current != $currentSlug &&
      _type == $currentType
    ][0...3] {
      _id,
      _type,
      title,
      "slug": slug.current,
      subtitle,
      coverImage,
      duration,
      highlights
    },
    "otherType": *[
      (_type == "tourPackage" || _type == "dayTour") &&
      slug.current != $currentSlug &&
      _type != $currentType
    ][0...3] {
      _id,
      _type,
      title,
      "slug": slug.current,
      subtitle,
      coverImage,
      duration,
      highlights
    }
  }`

  try {
    const result = await client.fetch<{ sameType: RelatedTour[]; otherType: RelatedTour[] }>(query, {
      currentSlug,
      currentType,
    })

    return [...result.sameType, ...result.otherType].slice(0, 3)
  } catch {
    return []
  }
}

export default async function RelatedTours({ currentSlug, currentType }: RelatedToursProps) {
  const tours = await getRelatedTours(currentSlug, currentType)

  if (tours.length === 0) {
    return null
  }

  return (
    <section className="mt-16 border-t border-stone-200 pt-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">
            More Tours
          </p>
          <h2 className="mt-3 text-3xl font-bold text-stone-900">接著看看這些相關行程</h2>
          <p className="mt-3 text-base leading-7 text-stone-600">
            如果你喜歡這個路線的節奏，下面這幾個行程通常也會一起被拿來比較。
          </p>
        </div>
        <Button href="/tours" variant="outline" size="sm">
          查看全部行程
        </Button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {tours.map((tour) => (
          <Link key={tour._id} href={`/tours/${tour.slug}`} className="group block">
            <article className="flex h-full flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_24px_70px_-40px_rgba(0,0,0,0.35)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_34px_90px_-40px_rgba(0,0,0,0.45)]">
              <div className="relative aspect-[4/3]">
                {tour.coverImage ? (
                  <Image
                    src={urlFor(tour.coverImage).width(800).height(600).quality(85).url()}
                    alt={tour.coverImage.alt || tour.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary-light to-primary/20">
                    <span className="text-5xl">{tour._type === 'tourPackage' ? '🧳' : '🚐'}</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/65 via-transparent to-transparent" />
                <div className="absolute left-4 top-4">
                  <span className="rounded-full bg-white/92 px-3 py-1.5 text-xs font-semibold text-stone-700 shadow-sm backdrop-blur-sm">
                    {tour._type === 'tourPackage' ? '多日套裝' : '一日包車'}
                  </span>
                </div>
                {tour.duration && (
                  <div className="absolute bottom-4 left-4 rounded-full border border-white/20 bg-black/35 px-3 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
                    {tour.duration}
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-6">
                <h3 className="text-xl font-bold text-stone-900 transition-colors group-hover:text-primary">
                  {tour.title}
                </h3>
                {tour.subtitle && (
                  <p className="mt-3 flex-1 line-clamp-3 text-sm leading-7 text-stone-600">
                    {tour.subtitle}
                  </p>
                )}
                {tour.highlights && tour.highlights.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tour.highlights.slice(0, 3).map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-600"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between border-t border-stone-100 pt-4">
                  <div>
                    <p className="text-sm font-medium text-stone-900">看這個行程的節奏</p>
                    <p className="mt-1 text-xs text-stone-500">快速抓重點、適合旅伴與玩法</p>
                  </div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-primary transition-all duration-300 group-hover:bg-primary group-hover:text-stone-950">
                    <svg
                      className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  )
}
