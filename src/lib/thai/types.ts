export type ThaiPhraseLevel = 'word' | 'phrase' | 'sentence' | 'dialogue'

export type ThaiParentCategory = {
  id: string
  label: string
  shortLabel: string
  description: string
  order: number
}

export type ThaiChildCategory = {
  id: string
  parentId: string
  label: string
  description: string
  order: number
}

export type ThaiPhrase = {
  id: string
  parentId: string
  childId: string
  level: ThaiPhraseLevel
  chinese: string
  thai: string
  romanization: string
  zhuyinHint: string
  usage: string
  genderNote?: string
  audio: {
    slow: string
    natural: string
  }
  tags: string[]
  priority: number
  isStarter?: boolean
}
