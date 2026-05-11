import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ThaiRecorderTool from '@/components/thai/ThaiRecorderTool'
import { childCategories, parentCategories, thaiPhrases } from '@/lib/thai/phrases'
import { canUseThaiRecorder } from '@/lib/thai/recorder-access'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Min 逐句錄音台｜清微旅行',
  robots: {
    index: false,
    follow: false,
  },
}

export default function ThaiRecordPage() {
  if (!canUseThaiRecorder()) {
    notFound()
  }

  return <ThaiRecorderTool parentCategories={parentCategories} childCategories={childCategories} phrases={thaiPhrases} />
}
