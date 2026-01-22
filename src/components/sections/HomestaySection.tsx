// src/components/sections/HomestaySection.tsx
import Image from 'next/image'
import { client, urlFor } from '@/sanity/client'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'

// 使用正確的 schema 欄位名稱
const homestayQuery = `*[_type == "homestay"][0]{
  heroTitle,
  heroSubtitle,
  heroMainImage,
  features
}`

interface Feature {
  icon?: string
  title?: string
  description?: string
}

export default async function HomestaySection() {
  const homestay = await client.fetch(homestayQuery).catch(() => null)

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Image */}
          <div className="relative h-64 md:h-96 rounded-2xl overflow-hidden">
            {homestay?.heroMainImage ? (
              <Image
                src={urlFor(homestay.heroMainImage).width(800).height(600).url()}
                alt={homestay.heroMainImage.alt || '芳縣民宿'}
                fill
                className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary-light to-primary/20 flex items-center justify-center">
                <span className="text-6xl">🏡</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div>
            <SectionTitle
              title={homestay?.heroTitle || '芳縣特色民宿'}
              subtitle="住進我們的家，體驗最道地的泰北生活"
              centered={false}
            />
            <p className="text-gray-600 mb-6">
              {homestay?.heroSubtitle || '遠離觀光區的寧靜，體驗真正的泰北在地生活'}
            </p>

            {homestay?.features && homestay.features.length > 0 && (
              <ul className="space-y-2 mb-6">
                {homestay.features.slice(0, 4).map((f: Feature, i: number) => (
                  <li key={i} className="flex items-center gap-2 text-gray-700">
                    <span className="text-primary">{f.icon || '✓'}</span>
                    {f.title}
                  </li>
                ))}
              </ul>
            )}

            <Button href="/homestay" variant="outline">
              了解更多
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
