'use client'

import { useMemo, useState } from 'react'
import { AlertCircle, Mic, Play, Save, Square } from 'lucide-react'
import type { ThaiChildCategory, ThaiParentCategory, ThaiPhrase } from '@/lib/thai/types'

type ThaiRecorderToolProps = {
  parentCategories: ThaiParentCategory[]
  childCategories: ThaiChildCategory[]
  phrases: ThaiPhrase[]
}

type Speed = 'natural' | 'slow'
type SlotKey = `${string}-${Speed}`

type LocalDraft = {
  draftId: string
  draftUrl: string
  previewUrl?: string
  trimStart: number
  trimEnd: number
}

const speedLabels: Record<Speed, string> = {
  natural: '自然速',
  slow: '慢速',
}

export default function ThaiRecorderTool({ parentCategories, childCategories, phrases }: ThaiRecorderToolProps) {
  const [selectedParentId, setSelectedParentId] = useState(parentCategories[0]?.id ?? 'basics')
  const [selectedChildId, setSelectedChildId] = useState('all')
  const [localDrafts, setLocalDrafts] = useState<Record<SlotKey, LocalDraft>>({})
  const [localRecordingKey, setLocalRecordingKey] = useState<SlotKey | null>(null)
  const [statuses, setStatuses] = useState<Record<SlotKey, string>>({})
  const [savedVersions, setSavedVersions] = useState<Record<SlotKey, number>>({})

  const children = useMemo(
    () => childCategories.filter((child) => child.parentId === selectedParentId),
    [childCategories, selectedParentId]
  )

  const visiblePhrases = useMemo(() => {
    return phrases
      .filter((phrase) => phrase.parentId === selectedParentId)
      .filter((phrase) => selectedChildId === 'all' || phrase.childId === selectedChildId)
      .sort((a, b) => a.priority - b.priority)
  }, [phrases, selectedChildId, selectedParentId])

  const setStatus = (key: SlotKey, message: string) => {
    setStatuses((current) => ({ ...current, [key]: message }))
  }

  const playUrl = async (url: string) => {
    await new Audio(url).play()
  }

  const savedAudioUrl = (phrase: ThaiPhrase, speed: Speed) => {
    const key = `${phrase.id}-${speed}` as SlotKey
    const version = savedVersions[key]
    return `${phrase.audio[speed]}${version ? `?v=${version}` : ''}`
  }

  const toggleLocalRecording = async (phrase: ThaiPhrase, speed: Speed) => {
    const key = `${phrase.id}-${speed}` as SlotKey

    if (localRecordingKey === key) {
      setStatus(key, '正在停止錄音並產生草稿')
      const response = await fetch('/api/thai/local-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      })
      const result = await response.json()

      if (!response.ok) {
        setStatus(key, result.error || '停止錄音失敗')
        return
      }

      setLocalRecordingKey(null)
      setLocalDrafts((current) => ({
        ...current,
        [key]: {
          draftId: result.draftId,
          draftUrl: `${result.draftPath}?v=${Date.now()}`,
          trimStart: 0,
          trimEnd: 0,
        },
      }))
      setStatus(key, '已產生草稿，請用裁切滑桿調整後再儲存正式版')
      return
    }

    setStatus(key, '正在啟動本機麥克風')
    const response = await fetch('/api/thai/local-recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'start', phraseId: phrase.id, speed }),
    })
    const result = await response.json()

    if (!response.ok) {
      setStatus(key, result.error || '本機錄音啟動失敗')
      return
    }

    setLocalRecordingKey(key)
    setStatus(key, '本機錄音中，講完請按停止')
  }

  const updateLocalDraftTrim = (key: SlotKey, field: 'trimStart' | 'trimEnd', value: number) => {
    setLocalDrafts((current) => {
      const draft = current[key]
      if (!draft) return current
      return {
        ...current,
        [key]: {
          ...draft,
          [field]: value,
        },
      }
    })
  }

  const previewLocalDraft = async (key: SlotKey) => {
    const draft = localDrafts[key]
    if (!draft) return

    setStatus(key, '正在產生裁切預覽')
    const response = await fetch('/api/thai/local-recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'preview',
        draftId: draft.draftId,
        trimStart: draft.trimStart,
        trimEnd: draft.trimEnd,
      }),
    })
    const result = await response.json()

    if (!response.ok) {
      setStatus(key, result.error || '裁切預覽失敗')
      return
    }

    const previewUrl = `${result.previewPath}?v=${Date.now()}`
    setLocalDrafts((current) => ({
      ...current,
      [key]: {
        ...draft,
        previewUrl,
      },
    }))
    setStatus(key, '裁切預覽已產生，可按「裁切版」試聽')
    await playUrl(previewUrl)
  }

  const finalizeLocalDraft = async (key: SlotKey) => {
    const draft = localDrafts[key]
    if (!draft) return

    setStatus(key, '正在儲存正式版')
    const response = await fetch('/api/thai/local-recording', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'finalize',
        draftId: draft.draftId,
        trimStart: draft.trimStart,
        trimEnd: draft.trimEnd,
      }),
    })
    const result = await response.json()

    if (!response.ok) {
      setStatus(key, result.error || '正式版儲存失敗')
      return
    }

    setSavedVersions((current) => ({ ...current, [key]: Date.now() }))
    setStatus(key, '已儲存正式音檔，請按「正式」試聽')
  }

  return (
    <div className="min-h-screen bg-[#F7FAF8] text-slate-950">
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="text-sm font-bold text-teal-800">Chiangway Thai Recorder</p>
          <div className="mt-2 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="font-display text-3xl font-black sm:text-4xl">Min 逐句錄音台</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                每一句分別錄自然速與慢速。先錄成草稿，調整頭尾裁切，確認後再儲存正式音檔。
              </p>
            </div>
            <a
              href="/thai"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 text-sm font-bold text-slate-800 hover:border-teal-500"
            >
              回學習頁
            </a>
          </div>
        </div>
      </section>

      <main className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[270px_1fr] lg:px-8">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
            {parentCategories.map((category) => {
              const active = selectedParentId === category.id
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setSelectedParentId(category.id)
                    setSelectedChildId('all')
                  }}
                  className={`min-h-12 rounded-lg border px-3 text-left text-sm font-bold ${
                    active
                      ? 'border-teal-600 bg-teal-700 text-white'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-teal-300'
                  }`}
                >
                  {category.shortLabel}
                </button>
              )
            })}
          </div>
        </aside>

        <section>
          <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedChildId('all')}
                className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold ${
                  selectedChildId === 'all' ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white'
                }`}
              >
                全部
              </button>
              {children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => setSelectedChildId(child.id)}
                  className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold ${
                    selectedChildId === child.id ? 'bg-slate-950 text-white' : 'border border-slate-200 bg-white'
                  }`}
                >
                  {child.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            {visiblePhrases.map((phrase) => (
              <article key={phrase.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-teal-700">#{phrase.priority}</p>
                    <h2 className="mt-1 text-xl font-black text-slate-950">{phrase.chinese}</h2>
                    <p className="mt-2 text-2xl font-black text-slate-900">{phrase.thai}</p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">{phrase.romanization}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {(['natural', 'slow'] as Speed[]).map((speed) => {
                      const key = `${phrase.id}-${speed}` as SlotKey
                      const localDraft = localDrafts[key]
                      const isLocalRecording = localRecordingKey === key
                      return (
                        <div key={speed} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-3 flex items-center justify-between gap-2">
                            <p className="text-sm font-black text-slate-900">{speedLabels[speed]}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={Boolean(localRecordingKey && !isLocalRecording)}
                              onClick={() => toggleLocalRecording(phrase, speed)}
                              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40 ${
                                isLocalRecording ? 'bg-red-600 text-white' : 'bg-teal-700 text-white'
                              }`}
                            >
                              {isLocalRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                              {isLocalRecording ? '停止' : '本機'}
                            </button>
                            <button
                              type="button"
                              onClick={() => playUrl(savedAudioUrl(phrase, speed))}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold"
                            >
                              <Play className="h-4 w-4" />
                              正式
                            </button>
                          </div>

                          {localDraft ? (
                            <div className="mt-3 rounded-lg border border-teal-100 bg-white p-3">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <p className="text-xs font-black text-teal-800">草稿裁切</p>
                                <button
                                  type="button"
                                  onClick={() => playUrl(localDraft.draftUrl)}
                                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-slate-200 px-3 text-xs font-bold"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  草稿
                                </button>
                              </div>
                              <label className="block text-xs font-bold text-slate-700">
                                開頭剪掉 {localDraft.trimStart.toFixed(2)} 秒
                                <input
                                  type="range"
                                  min="0"
                                  max="3"
                                  step="0.05"
                                  value={localDraft.trimStart}
                                  onChange={(event) => updateLocalDraftTrim(key, 'trimStart', Number(event.target.value))}
                                  className="mt-2 w-full"
                                />
                              </label>
                              <label className="mt-3 block text-xs font-bold text-slate-700">
                                結尾剪掉 {localDraft.trimEnd.toFixed(2)} 秒
                                <input
                                  type="range"
                                  min="0"
                                  max="3"
                                  step="0.05"
                                  value={localDraft.trimEnd}
                                  onChange={(event) => updateLocalDraftTrim(key, 'trimEnd', Number(event.target.value))}
                                  className="mt-2 w-full"
                                />
                              </label>
                              <div className="mt-3 grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => previewLocalDraft(key)}
                                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3 text-xs font-black text-teal-800"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  預覽裁切
                                </button>
                                <button
                                  type="button"
                                  disabled={!localDraft.previewUrl}
                                  onClick={() => localDraft.previewUrl && playUrl(localDraft.previewUrl)}
                                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  裁切版
                                </button>
                                <button
                                  type="button"
                                  onClick={() => finalizeLocalDraft(key)}
                                  className="col-span-2 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-xs font-black text-slate-950"
                                >
                                  <Save className="h-3.5 w-3.5" />
                                  儲存正式版
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {statuses[key] ? (
                            <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-slate-600">
                              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-700" />
                              {statuses[key]}
                            </p>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
