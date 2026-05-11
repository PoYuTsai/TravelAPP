import { LaunchIcon } from '@sanity/icons'
import { useToast } from '@sanity/ui'
import { useState } from 'react'
import { type DocumentActionComponent } from 'sanity'

export const openQuotePageAction: DocumentActionComponent = (props) => {
  const { type, draft, published } = props
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(false)

  if (type !== 'pricingExample') {
    return null
  }

  const doc = (draft || published) as
    | {
        publicSlug?: { current?: string }
      }
    | undefined

  const slug = doc?.publicSlug?.current?.trim()

  return {
    label: isLoading ? '開啟中...' : '開啟客戶頁',
    icon: LaunchIcon,
    disabled: isLoading || !slug,
    title: slug
      ? '在新分頁打開這張 quote 的客戶頁'
      : '請先建立公開 quote 連結。',
    onHandle: () => {
      if (!slug) return

      setIsLoading(true)
      try {
        window.open(`/quote/${encodeURIComponent(slug)}`, '_blank', 'noopener,noreferrer')
      } catch (error) {
        toast.push({
          status: 'error',
          title: '無法開啟客戶頁',
          description: '請稍後再試一次。',
        })
      } finally {
        setIsLoading(false)
      }
    },
  }
}
