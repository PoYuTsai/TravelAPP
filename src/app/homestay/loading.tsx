import { HeroSkeleton, SectionTitleSkeleton, CardGridSkeleton } from '@/components/ui/LoadingSkeleton'

export default function HomestayLoading() {
  return (
    <div className="py-12 md:py-20">
      <HeroSkeleton />
      <div className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <SectionTitleSkeleton />
          <CardGridSkeleton count={4} />
        </div>
      </div>
    </div>
  )
}
