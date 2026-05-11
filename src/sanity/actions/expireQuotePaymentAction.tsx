import { ClockIcon } from '@sanity/icons'
import { useToast } from '@sanity/ui'
import { useState } from 'react'
import { type DocumentActionComponent, useDocumentOperation } from 'sanity'

import { canManuallyExpireQuotePayment } from '@/lib/quote/paymentAdminState'

export const expireQuotePaymentAction: DocumentActionComponent = (props) => {
  const { id, type, draft, published } = props
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const { patch } = useDocumentOperation(id, type)

  if (type !== 'pricingExample') {
    return null
  }

  const doc = (draft || published) as
    | {
        paymentState?: 'draft' | 'payment_ready' | 'payment_pending' | 'paid' | 'expired'
      }
    | undefined

  const currentState = doc?.paymentState ?? 'draft'
  const canExpire = canManuallyExpireQuotePayment(currentState)

  return {
    label: isLoading ? '處理中...' : '標記付款已過期',
    icon: ClockIcon,
    disabled: isLoading || !doc || !canExpire,
    title: canExpire
      ? '把這張 quote 的付款狀態改成已過期'
      : '只有待付款或待確認中的 quote 才能標記過期',
    onHandle: async () => {
      if (!doc || !canExpire) return

      setIsLoading(true)
      try {
        patch.execute([
          {
            set: {
              paymentState: 'expired',
            },
          },
        ])

        toast.push({
          status: 'success',
          title: '已標記為過期',
          description: '舊的付款狀態已經切成 expired。',
        })
      } catch (error) {
        toast.push({
          status: 'error',
          title: '更新失敗',
          description: '請稍後再試一次。',
        })
      } finally {
        setIsLoading(false)
      }
    },
  }
}
