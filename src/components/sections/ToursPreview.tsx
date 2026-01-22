// src/components/sections/ToursPreview.tsx
import Link from 'next/link'
import { client } from '@/sanity/client'
import PackageCard from '@/components/tours/PackageCard'
import SectionTitle from '@/components/ui/SectionTitle'
import Button from '@/components/ui/Button'

const packagesQuery = `*[_type == "tourPackage"] | order(order asc) [0...3] {
  title,
  "slug": slug.current,
  subtitle,
  coverImage,
  duration,
  highlights
}`

export default async function ToursPreview() {
  const packages = await client.fetch(packagesQuery).catch(() => [])

  if (packages.length === 0) {
    return null
  }

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitle
          title="行程案例"
          subtitle="每一組家庭的專屬清邁回憶"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {packages.slice(0, 2).map((pkg: any) => (
            <PackageCard
              key={pkg.slug}
              title={pkg.title}
              slug={pkg.slug}
              subtitle={pkg.subtitle}
              coverImage={pkg.coverImage}
              duration={pkg.duration}
              highlights={pkg.highlights}
            />
          ))}
        </div>

        <div className="text-center">
          <Button href="/tours" variant="outline">
            查看更多行程案例
          </Button>
        </div>
      </div>
    </section>
  )
}
