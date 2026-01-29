import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'API 文件',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ApiDocsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
