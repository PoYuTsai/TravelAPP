import { CreditCardIcon } from '@sanity/icons'
import { useToast } from '@sanity/ui'
import { useState } from 'react'
import { type DocumentActionComponent, useDocumentOperation } from 'sanity'

import {
  buildPrepareQuotePaymentPatch,
  getPrepareQuotePaymentProblem,
} from '@/lib/quote/paymentAdminState'

export const prepareQuotePaymentAction: DocumentActionComponent = (props) => {
  const { id, type, draft, published } = props
  const toast = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const { patch } = useDocumentOperation(id, type)

  if (type !== 'pricingExample') {
    return null
  }

  const doc = (draft || published) as
    | {
        publicSlug?: { current?: string }
        orderNo?: string
        depositAmountTWD?: number
        paymentExpiresAt?: string
        paymentState?: 'draft' | 'payment_ready' | 'payment_pending' | 'paid' | 'expired'
      }
    | undefined

  const problem =
    !doc?.publicSlug?.current
      ? '請先建立公開 quote 連結。'
      : getPrepareQuotePaymentProblem({
          orderNo: doc.orderNo,
          depositAmountTWD: doc.depositAmountTWD,
          paymentExpiresAt: doc.paymentExpiresAt,
          paymentState: doc.paymentState,
        })

  return {
    label: isLoading ? '設定中...' : '開啟訂金付款',
    icon: CreditCardIcon,
    disabled: isLoading || !doc || Boolean(problem),
    title: problem ?? '把這張報價單切成可付款狀態',
    onHandle: async () => {
      if (!doc || problem) return

      setIsLoading(true)
      try {
        patch.execute([
          {
            set: buildPrepareQuotePaymentPatch(
              {
                orderNo: doc.orderNo,
                depositAmountTWD: doc.depositAmountTWD,
                paymentExpiresAt: doc.paymentExpiresAt,
                paymentState: doc.paymentState,
              },
              new Date()
            ),
          },
        ])

        toast.push({
          status: 'success',
          title: '已開啟訂金付款',
          description: '這張 quote 現在可以建立訂金付款連結。',
        })
      } catch (error) {
        toast.push({
          status: 'error',
          title: '設定失敗',
          description: '請稍後再試一次。',
        })
      } finally {
        setIsLoading(false)
      }
    },
  }
}
