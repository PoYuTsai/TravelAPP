'use client'

import { useMemo, useState } from 'react'
import {
  Baby,
  Car,
  HeartPulse,
  Hotel,
  Mic,
  MessageCircle,
  Play,
  ShoppingBag,
  Sparkles,
  Utensils,
  Volume2,
} from 'lucide-react'
import { trackEvent, trackLineClick } from '@/lib/analytics'
import { LINE_URL } from '@/lib/navigation'
import type { ThaiChildCategory, ThaiParentCategory, ThaiPhrase } from '@/lib/thai/types'

type ThaiLearningToolProps = {
  parentCategories: ThaiParentCategory[]
  childCategories: ThaiChildCategory[]
  phrases: ThaiPhrase[]
  starterPhrases: ThaiPhrase[]
  showRecorderLink?: boolean
}

const categoryIcons = {
  basics: MessageCircle,
  food: Utensils,
  transport: Car,
  family: Baby,
  massage: Sparkles,
  'hotel-airport': Hotel,
  shopping: ShoppingBag,
  emergency: HeartPulse,
} as const

export default function ThaiLearningTool({
  parentCategories,
  childCategories,
  phrases,
  starterPhrases,
  showRecorderLink = false,
}: ThaiLearningToolProps) {
  const [selectedParentId, setSelectedParentId] = useState(parentCategories[0]?.id ?? 'basics')
  const [selectedChildId, setSelectedChildId] = useState<string>('all')
  const [showRomanization, setShowRomanization] = useState(true)
  const [showZhuyin, setShowZhuyin] = useState(false)
  const [audioStatus, setAudioStatus] = useState<Record<string, 'ready' | 'missing'>>({})

  const selectedParent = parentCategories.find((category) => category.id === selectedParentId)

  const visibleChildren = useMemo(
    () => childCategories.filter((category) => category.parentId === selectedParentId),
    [childCategories, selectedParentId]
  )

  const visiblePhrases = useMemo(() => {
    return phrases
      .filter((phrase) => phrase.parentId === selectedParentId)
      .filter((phrase) => selectedChildId === 'all' || phrase.childId === selectedChildId)
      .sort((a, b) => a.priority - b.priority)
  }, [phrases, selectedParentId, selectedChildId])

  const handleParentChange = (parentId: string) => {
    setSelectedParentId(parentId)
    setSelectedChildId('all')
    trackEvent('thai_category_select', {
      event_category: 'thai_learning',
      parent_id: parentId,
    })
  }

  const playAudio = async (phrase: ThaiPhrase, speed: 'slow' | 'natural') => {
    const audioPath = phrase.audio[speed]
    const statusKey = `${phrase.id}-${speed}`

    trackEvent('thai_audio_play', {
      event_category: 'thai_learning',
      phrase_id: phrase.id,
      speed,
    })

    try {
      const audio = new Audio(audioPath)
      await audio.play()
      setAudioStatus((current) => ({ ...current, [statusKey]: 'ready' }))
    } catch {
      setAudioStatus((current) => ({ ...current, [statusKey]: 'missing' }))
    }
  }

  return (
    <div className="bg-[#F8FAF8] text-slate-950">
      <section className="relative overflow-hidden border-b border-slate-200 bg-white">
        <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(135deg,#FFF4C7_0%,#E4F4EE_48%,#E8F1F8_100%)]" />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-end">
            <div className="max-w-2xl">
              <p className="mb-3 inline-flex rounded-full border border-teal-200 bg-white/80 px-3 py-1 text-sm font-medium text-teal-800">
                Chiangway Thai Cards
              </p>
              <h1 className="font-display text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
                清邁旅行泰文小卡
              </h1>
              <p className="mt-4 text-lg leading-8 text-slate-700">
                Min 親錄發音，給台灣家庭出發清邁前練習真的用得到的泰文。
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={LINE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackLineClick('Thai Tool Hero')}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-primary-dark"
                >
                  加 LINE 問清邁行程
                </a>
                <a
                  href="#thai-phrases"
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-800 transition-colors hover:border-teal-400 hover:text-teal-800"
                >
                  看全部小卡
                </a>
                {showRecorderLink ? (
                  <a
                    href="/thai/record"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-black text-red-700 transition-colors hover:border-red-300 hover:bg-red-100"
                  >
                    <Mic className="h-4 w-4" aria-hidden="true" />
                    Min 錄音台
                  </a>
                ) : null}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-teal-800">今日 5 句</p>
                  <p className="text-xs text-slate-500">先從最常用的清邁現場句開始</p>
                </div>
                <Volume2 className="h-5 w-5 text-teal-700" aria-hidden="true" />
              </div>
              <div className="grid gap-3">
                {starterPhrases.map((phrase) => (
                  <MiniPhraseRow
                    key={phrase.id}
                    phrase={phrase}
                    onPlay={() => playAudio(phrase, 'natural')}
                    isMissing={audioStatus[`${phrase.id}-natural`] === 'missing'}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="thai-phrases" className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-black text-slate-950">旅行情境</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              內容以清微旅行實際旅客場景優先；注音只做輔助記憶，正確發音以 Min 錄音為準。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ToggleButton active={showRomanization} onClick={() => setShowRomanization((value) => !value)}>
              羅馬拼音
            </ToggleButton>
            <ToggleButton active={showZhuyin} onClick={() => setShowZhuyin((value) => !value)}>
              注音輔助
            </ToggleButton>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[260px_1fr]">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
              {parentCategories.map((category) => {
                const Icon = categoryIcons[category.id as keyof typeof categoryIcons] ?? MessageCircle
                const isActive = category.id === selectedParentId
                return (
                  <button
                    key={category.id}
                    type="button"
                    data-testid={`thai-category-${category.id}`}
                    onClick={() => handleParentChange(category.id)}
                    className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors ${
                      isActive
                        ? 'border-teal-500 bg-teal-700 text-white shadow-sm'
                        : 'border-slate-200 bg-white text-slate-800 hover:border-teal-300 hover:bg-teal-50'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{category.shortLabel}</span>
                      <span className={`block text-xs ${isActive ? 'text-teal-50' : 'text-slate-500'}`}>
                        {phrases.filter((phrase) => phrase.parentId === category.id).length} 句
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </aside>

          <div>
            <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-950">{selectedParent?.label}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{selectedParent?.description}</p>
                </div>
                <p className="text-sm font-bold text-teal-800">{visiblePhrases.length} 句</p>
              </div>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  data-testid="thai-child-all"
                  onClick={() => setSelectedChildId('all')}
                  className={`min-h-10 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors ${
                    selectedChildId === 'all'
                      ? 'bg-slate-950 text-white'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                  }`}
                >
                  全部
                </button>
                {visibleChildren.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    data-testid={`thai-child-${child.id}`}
                    onClick={() => setSelectedChildId(child.id)}
                    className={`min-h-10 shrink-0 cursor-pointer rounded-full px-4 text-sm font-bold transition-colors ${
                      selectedChildId === child.id
                        ? 'bg-slate-950 text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                    }`}
                  >
                    {child.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {visiblePhrases.map((phrase) => (
                <PhraseCard
                  key={phrase.id}
                  phrase={phrase}
                  child={childCategories.find((category) => category.id === phrase.childId)}
                  showRomanization={showRomanization}
                  showZhuyin={showZhuyin}
                  onPlay={playAudio}
                  audioStatus={audioStatus}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_auto] lg:px-8">
          <div>
            <h2 className="text-2xl font-black text-slate-950">清邁親子包車，也可以一起安排</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              有些句子可以先練起來；如果你希望旅途中有人協助溝通、安排動線，清微旅行可以協助清邁包車、親子景點與中文導遊安排。
            </p>
          </div>
          <a
            href={LINE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackLineClick('Thai Tool Bottom CTA')}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-slate-950 transition-colors hover:bg-primary-dark"
          >
            LINE 詢問行程
          </a>
        </div>
      </section>
    </div>
  )
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      data-testid={`thai-toggle-${String(children)}`}
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-10 cursor-pointer rounded-full border px-4 text-sm font-bold transition-colors ${
        active
          ? 'border-teal-600 bg-teal-700 text-white'
          : 'border-slate-300 bg-white text-slate-700 hover:border-teal-400 hover:text-teal-800'
      }`}
    >
      {children}
    </button>
  )
}

function MiniPhraseRow({
  phrase,
  onPlay,
  isMissing,
}: {
  phrase: ThaiPhrase
  onPlay: () => void
  isMissing: boolean
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-950">{phrase.chinese}</p>
        <p className="truncate text-base font-semibold text-teal-800">{phrase.thai}</p>
        {isMissing && <p className="mt-1 text-xs font-medium text-amber-700">錄音準備中</p>}
      </div>
      <button
        type="button"
        onClick={onPlay}
        title="播放 Min 發音"
        aria-label={`播放 ${phrase.chinese} 的 Min 發音`}
        className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-slate-950 text-white transition-colors hover:bg-teal-700"
      >
        <Play className="h-4 w-4 fill-current" aria-hidden="true" />
      </button>
    </div>
  )
}

function PhraseCard({
  phrase,
  child,
  showRomanization,
  showZhuyin,
  onPlay,
  audioStatus,
}: {
  phrase: ThaiPhrase
  child?: ThaiChildCategory
  showRomanization: boolean
  showZhuyin: boolean
  onPlay: (phrase: ThaiPhrase, speed: 'slow' | 'natural') => void
  audioStatus: Record<string, 'ready' | 'missing'>
}) {
  const naturalMissing = audioStatus[`${phrase.id}-natural`] === 'missing'
  const slowMissing = audioStatus[`${phrase.id}-slow`] === 'missing'

  return (
    <article data-testid="thai-phrase-card" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          {child && (
            <p className="mb-2 inline-flex rounded-full bg-teal-50 px-2.5 py-1 text-xs font-bold text-teal-800">
              {child.label}
            </p>
          )}
          <h3 className="text-xl font-black leading-tight text-slate-950">{phrase.chinese}</h3>
          <p className="mt-2 text-2xl font-bold leading-relaxed text-teal-800">{phrase.thai}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPlay(phrase, 'natural')}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-bold text-white transition-colors hover:bg-teal-700"
        >
          <Volume2 className="h-4 w-4" aria-hidden="true" />
          自然
        </button>
        <button
          type="button"
          onClick={() => onPlay(phrase, 'slow')}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 transition-colors hover:border-teal-400 hover:text-teal-800"
        >
          <Volume2 className="h-4 w-4" aria-hidden="true" />
          慢速
        </button>
      </div>

      {(naturalMissing || slowMissing) && (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
          錄音準備中
        </p>
      )}

      <div className="space-y-3 text-sm leading-6">
        {showRomanization && (
          <div>
            <p className="font-bold text-slate-500">羅馬拼音</p>
            <p className="text-slate-800">{phrase.romanization}</p>
          </div>
        )}
        {showZhuyin && (
          <div>
            <p className="font-bold text-slate-500">注音輔助</p>
            <p className="text-slate-800">{phrase.zhuyinHint}</p>
          </div>
        )}
        <div>
          <p className="font-bold text-slate-500">使用場景</p>
          <p className="text-slate-700">{phrase.usage}</p>
        </div>
        {phrase.genderNote && <p className="rounded-md bg-slate-50 px-3 py-2 text-slate-600">{phrase.genderNote}</p>}
      </div>
    </article>
  )
}
