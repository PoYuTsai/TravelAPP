import Link from 'next/link'
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'

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

// Get related tours (excluding current tour)
async function getRelatedTours(currentSlug: string, currentType: string): Promise<RelatedTour[]> {
  // First try to get tours of the same type, then fill with other type
  const query = `{
    "sameType": *[(_type == "tourPackage" || _type == "dayTour") && slug.current != $currentSlug && _type == $currentType][0...2] {
      _id,
      _type,
      title,
      "slug": slug.current,
      subtitle,
      coverImage,
      duration,
      highlights
    },
    "otherType": *[(_type == "tourPackage" || _type == "dayTour") && slug.current != $currentSlug && _type != $currentType][0...2] {
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
    const result = await client.fetch<{ sameType: RelatedTour[]; otherType: RelatedTour[] }>(
      query,
      { currentSlug, currentType }
    )

    // Combine results, prioritizing same type
    const combined = [...result.sameType, ...result.otherType]
    return combined.slice(0, 3)
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
    <section className="mt-12 pt-12 border-t border-gray-200">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">其他推薦行程</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {tours.map((tour) => (
          <Link key={tour._id} href={`/tours/${tour.slug}`} className="group">
            <article className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow h-full flex flex-col">
              <div className="relative h-40">
                {tour.coverImage ? (
                  <Image
                    src={urlFor(tour.coverImage).width(800).height(500).quality(85).url()}
                    alt={tour.coverImage.alt || tour.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                    <span className="text-4xl">
                      {tour._type === 'tourPackage' ? '🌴' : '🌿'}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs bg-primary/20 text-primary-dark px-2 py-0.5 rounded-full font-medium">
                    {tour._type === 'tourPackage' ? '套裝行程' : '一日遊'}
                  </span>
                  {tour.duration && (
                    <span className="text-xs text-gray-500">{tour.duration}</span>
                  )}
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors line-clamp-2">
                  {tour.title}
                </h3>
                {tour.subtitle && (
                  <p className="text-gray-600 text-sm flex-1 line-clamp-2">{tour.subtitle}</p>
                )}
                {tour.highlights && tour.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tour.highlights.slice(0, 2).map((h) => (
                      <span key={h} className="text-xs text-gray-500">
                        #{h}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  )
}
