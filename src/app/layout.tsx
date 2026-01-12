import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '清微旅行 Chiangway Travel | 清邁親子包車自由行',
  description: '清邁親子自由行首選！專業中文導遊、安全舒適包車服務，為您的家庭打造難忘的清邁之旅。',
  keywords: '清邁親子自由行, 清邁包車, 清邁中文導遊, 清邁家庭旅遊, 清邁親子景點',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-TW">
      <body>{children}</body>
    </html>
  )
}
