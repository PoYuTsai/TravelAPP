/**
 * Reusable loading skeleton components
 */

// Base skeleton pulse animation
function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
  )
}

// Card skeleton for blog/tour cards
export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-md h-full">
      <Skeleton className="h-48 rounded-none" />
      <div className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  )
}

// Grid of card skeletons
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

// Section title skeleton
export function SectionTitleSkeleton() {
  return (
    <div className="text-center mb-8 space-y-2">
      <Skeleton className="h-8 w-48 mx-auto" />
      <Skeleton className="h-4 w-64 mx-auto" />
    </div>
  )
}

// Hero section skeleton
export function HeroSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-8 space-y-4">
        <Skeleton className="h-10 w-64 mx-auto" />
        <Skeleton className="h-6 w-96 mx-auto" />
      </div>
      <Skeleton className="h-[400px] max-w-4xl mx-auto rounded-xl" />
    </div>
  )
}

// Filter/Category bar skeleton
export function FilterSkeleton() {
  return (
    <div className="flex flex-wrap justify-center gap-2 mb-8">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-20 rounded-full" />
      ))}
    </div>
  )
}

// Page loading skeleton (full page)
export function PageLoadingSkeleton() {
  return (
    <div className="py-12 md:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionTitleSkeleton />
        <FilterSkeleton />
        <CardGridSkeleton />
      </div>
    </div>
  )
}

// Small case card skeleton for tours page
export function CaseSkeleton() {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-5 w-20" />
        <Skeleton className="h-4 w-12 rounded-full" />
      </div>
      <Skeleton className="h-4 w-24 mb-1" />
      <Skeleton className="h-3 w-16" />
    </div>
  )
}

// Grid of case skeletons
export function CaseGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CaseSkeleton key={i} />
      ))}
    </div>
  )
}

export default Skeleton
