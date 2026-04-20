import type { Metadata } from 'next'
import './quote-overrides.css'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function QuoteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
