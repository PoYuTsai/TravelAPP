import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: '清微旅行 Chiangway Travel | 清邁親子包車自由行',
    template: '%s | 清微旅行',
  },
  description: '清邁親子自由行首選！專業中文導遊、安全舒適包車服務，為您的家庭打造難忘的清邁之旅。',
  keywords: ['清邁親子自由行', '清邁包車', '清邁中文導遊', '清邁家庭旅遊', '清邁親子景點', '清邁自由行', '泰國親子旅遊'],
  authors: [{ name: '清微旅行' }],
  openGraph: {
    type: 'website',
    locale: 'zh_TW',
    siteName: '清微旅行 Chiangway Travel',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body className="flex flex-col min-h-screen">
        {/* Header will be added here */}
        <main className="flex-grow">
          {children}
        </main>
        {/* Footer will be added here */}
      </body>
    </html>
  )
}
