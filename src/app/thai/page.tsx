import type { Metadata } from 'next'
import ThaiLearningTool from '@/components/thai/ThaiLearningTool'
import {
  childCategories,
  getStarterPhrases,
  parentCategories,
  thaiPhrases,
} from '@/lib/thai/phrases'
import { canUseThaiRecorder } from '@/lib/thai/recorder-access'

export const metadata: Metadata = {
  title: '清邁旅行泰文小卡｜Min 真人發音',
  description:
    '清微旅行整理的清邁旅行泰文小卡，Min 親錄發音，給台灣家庭出發前練習餐廳、包車、親子、按摩、飯店與緊急求助常用泰文。',
  keywords: [
    '泰文小卡',
    '清邁旅行泰文',
    '泰國不辣怎麼說',
    '泰文廁所在哪裡',
    '清邁包車泰文',
    '泰國親子旅遊',
  ],
  alternates: {
    canonical: 'https://chiangway-travel.com/thai',
  },
  openGraph: {
    title: '清邁旅行泰文小卡｜Min 真人發音',
    description: '出發清邁前，先練幾句真的用得到的泰文。餐廳、包車、親子、按摩、飯店與求助情境一次整理。',
    url: 'https://chiangway-travel.com/thai',
    type: 'website',
    images: [
      {
        url: '/images/og-image.png',
        width: 1200,
        height: 630,
        alt: '清微旅行泰文小卡',
      },
    ],
  },
}

const thaiLearningSchema = {
  '@context': 'https://schema.org',
  '@type': 'LearningResource',
  '@id': 'https://chiangway-travel.com/thai#learning-resource',
  name: '清邁旅行泰文小卡',
  description: 'Min 親錄發音，給台灣家庭出發清邁前練習真的用得到的泰文。',
  inLanguage: ['zh-TW', 'th'],
  learningResourceType: 'Flashcard',
  provider: {
    '@type': 'Organization',
    name: '清微旅行 Chiangway Travel',
    url: 'https://chiangway-travel.com',
  },
}

export default function ThaiPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(thaiLearningSchema) }}
      />
      <ThaiLearningTool
        parentCategories={parentCategories}
        childCategories={childCategories}
        phrases={thaiPhrases}
        starterPhrases={getStarterPhrases()}
        showRecorderLink={canUseThaiRecorder()}
      />
    </>
  )
}
