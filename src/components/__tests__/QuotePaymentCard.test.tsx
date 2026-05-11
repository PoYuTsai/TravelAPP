/* eslint-disable @next/next/no-img-element */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: Record<string, unknown>) => {
    return (
      <a href={typeof href === 'string' ? href : '#'} {...props}>
        {children}
      </a>
    )
  },
}))

import { QuotePaymentCard } from '@/components/quote/QuotePaymentCard'
import type { QuotePayment } from '@/lib/quote/paymentState'

function renderCard(
  payment: Partial<QuotePayment>,
  options?: { launchUrl?: string | null }
) {
  return renderToStaticMarkup(
    <QuotePaymentCard
      launchUrl={options?.launchUrl}
      payment={{
        state: 'draft',
        depositAmountTWD: 0,
        depositLabel: '服務訂金',
        provider: 'ecpay',
        tradeNo: null,
        paymentUrl: null,
        createdAt: null,
        expiresAt: null,
        paidAt: null,
        orderNo: null,
        ...payment,
      }}
    />
  )
}

describe('QuotePaymentCard', () => {
  it('renders informational copy for draft quotes', () => {
    const html = renderCard({ state: 'draft' })

    expect(html).toContain('RESERVATION PAYMENT')
    expect(html).not.toContain('href=')
  })

  it('renders the payment CTA for payment-ready quotes', () => {
    const html = renderCard({
      state: 'payment_ready',
      depositAmountTWD: 4000,
      depositLabel: '包車訂金',
      expiresAt: '2026-05-12T10:00:00.000Z',
      paymentUrl: 'https://pay.example/ready',
      orderNo: 'CW20260511-001',
    })

    expect(html).toContain('NT$ 4,000')
    expect(html).toContain('包車訂金')
    expect(html).toContain('https://pay.example/ready')
  })

  it('uses the explicit launch url when no stored payment url exists yet', () => {
    const html = renderCard(
      {
        state: 'payment_ready',
        depositAmountTWD: 4000,
        paymentUrl: null,
      },
      { launchUrl: '/api/quote/test-slug/payment-link' }
    )

    expect(html).toContain('/api/quote/test-slug/payment-link')
  })

  it('renders waiting copy for payment-pending quotes', () => {
    const html = renderCard({
      state: 'payment_pending',
      depositAmountTWD: 4000,
      paymentUrl: 'https://pay.example/pending',
    })

    expect(html).toContain('https://pay.example/pending')
    expect(html).toContain('NT$ 4,000')
  })

  it('renders a paid confirmation and hides the pay CTA', () => {
    const html = renderCard({
      state: 'paid',
      depositAmountTWD: 4000,
      paidAt: '2026-05-11T10:30:00.000Z',
    })

    expect(html).toContain('NT$ 4,000')
    expect(html).not.toContain('href=')
  })

  it('renders expiry guidance for expired quotes', () => {
    const html = renderCard({
      state: 'expired',
      depositAmountTWD: 4000,
    })

    expect(html).toContain('NT$ 4,000')
    expect(html).not.toContain('href=')
  })
})
