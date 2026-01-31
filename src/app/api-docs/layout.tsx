import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API 文件',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: 'https://chiangway-travel.com/api-docs',
  },
}

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
