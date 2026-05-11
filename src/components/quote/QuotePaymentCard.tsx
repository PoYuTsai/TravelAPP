import Link from 'next/link'
import {
  Clock3,
  ExternalLink,
  ShieldCheck,
  WalletCards,
} from 'lucide-react'

import type { QuotePayment } from '@/lib/quote/paymentState'
import { getQuotePaymentStatusLabel } from '@/lib/quote/paymentState'

const currencyFormatter = new Intl.NumberFormat('en-US')

function formatDateTime(value: string | null) {
  if (!value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function StateBadge({ state }: { state: QuotePayment['state'] }) {
  const palette =
    state === 'paid'
      ? {
          background: 'rgba(74, 107, 58, 0.12)',
          border: '1px solid rgba(74, 107, 58, 0.22)',
          color: '#35512A',
        }
      : state === 'expired'
        ? {
            background: 'rgba(185, 28, 28, 0.08)',
            border: '1px solid rgba(185, 28, 28, 0.2)',
            color: '#991B1B',
          }
        : {
            background: 'rgba(202, 138, 4, 0.10)',
            border: '1px solid rgba(202, 138, 4, 0.24)',
            color: '#8A5A00',
          }

  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-[12px] font-semibold"
      style={palette}
    >
      {getQuotePaymentStatusLabel(state)}
    </span>
  )
}

export function QuotePaymentCard({
  payment,
  launchUrl,
}: {
  payment: QuotePayment
  launchUrl?: string | null
}) {
  const expiresAtLabel = formatDateTime(payment.expiresAt)
  const paidAtLabel = formatDateTime(payment.paidAt)
  const amountLabel = `NT$ ${currencyFormatter.format(payment.depositAmountTWD)}`
  const activeLaunchUrl = launchUrl ?? payment.paymentUrl

  return (
    <section
      className="overflow-hidden rounded-[24px] p-7 md:p-8"
      style={{
        background: 'rgba(255, 255, 255, 0.62)',
        backdropFilter: 'blur(16px) saturate(1.12)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.12)',
        border: '1.5px solid rgba(202, 138, 4, 0.22)',
        boxShadow: '0 20px 50px -15px rgba(110, 77, 49, 0.10)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-[0.22em]" style={{ color: '#CA8A04' }}>
            RESERVATION PAYMENT
          </div>
          <h3
            className="mt-2 text-[22px] font-black"
            style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
          >
            訂金與檔期保留
          </h3>
        </div>
        <StateBadge state={payment.state} />
      </div>

      {payment.state === 'draft' && (
        <div className="mt-5 rounded-[20px] border border-dashed border-[#EAE4D2] bg-[#FFFCF5] p-5">
          <p className="text-[15px] font-semibold" style={{ color: '#3A3224' }}>
            此報價目前僅供確認，尚未開放付款。
          </p>
          <p className="mt-2 text-[14px] leading-[1.8]" style={{ color: '#5F5648' }}>
            等你確認這組日期與內容後，我們再開啟專屬付款連結。付款完成後才會正式保留檔期。
          </p>
        </div>
      )}

      {payment.state !== 'draft' && (
        <div className="mt-5 space-y-5">
          <div className="rounded-[20px] border border-[#EFE5CB] bg-[#FFF9ED] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[13px] font-semibold" style={{ color: '#7A6F5C' }}>
                  本次需先支付
                </div>
                <div
                  className="mt-2 text-[28px] font-black md:text-[34px]"
                  style={{ color: '#0F0B05', fontFamily: 'var(--font-display, serif)' }}
                >
                  {amountLabel}
                </div>
              </div>
              <span
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold"
                style={{
                  background: 'rgba(202, 138, 4, 0.12)',
                  color: '#8A5A00',
                }}
              >
                <WalletCards size={16} />
                {payment.depositLabel}
              </span>
            </div>

            {(payment.orderNo || expiresAtLabel) && (
              <div className="mt-4 grid gap-3 border-t border-dashed border-[#E5D8B6] pt-4 text-[13px] md:grid-cols-2">
                {payment.orderNo && (
                  <div>
                    <div style={{ color: '#7A6F5C' }}>訂單編號</div>
                    <div className="mt-1 font-semibold tracking-wide" style={{ color: '#0F0B05' }}>
                      {payment.orderNo}
                    </div>
                  </div>
                )}
                {expiresAtLabel && (
                  <div>
                    <div style={{ color: '#7A6F5C' }}>付款期限</div>
                    <div className="mt-1 inline-flex items-center gap-2 font-semibold" style={{ color: '#0F0B05' }}>
                      <Clock3 size={15} />
                      {expiresAtLabel}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {payment.state === 'payment_ready' && (
            <div className="rounded-[20px] border border-[#EAE4D2] bg-white p-5">
              <p className="text-[14px] leading-[1.8]" style={{ color: '#3A3224' }}>
                付款完成後才正式保留檔期。若因我們這邊臨時無法提供服務，會再協助你處理退款或後續安排。
              </p>
              {activeLaunchUrl && (
                <Link
                  href={activeLaunchUrl}
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-black text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: '#0F0B05' }}
                >
                  支付訂金
                  <ExternalLink size={16} />
                </Link>
              )}
            </div>
          )}

          {payment.state === 'payment_pending' && (
            <div className="rounded-[20px] border border-[#EAE4D2] bg-white p-5">
              <p className="text-[14px] leading-[1.8]" style={{ color: '#3A3224' }}>
                我們正在等待付款確認。完成付款後，頁面狀態會更新成已收到訂金。
              </p>
              {activeLaunchUrl && (
                <Link
                  href={activeLaunchUrl}
                  className="mt-4 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] font-black text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: '#0F0B05' }}
                >
                  重新開啟付款頁
                  <ExternalLink size={16} />
                </Link>
              )}
            </div>
          )}

          {payment.state === 'paid' && (
            <div className="rounded-[20px] border border-[#DDE8D8] bg-[#F7FBF5] p-5">
              <p className="inline-flex items-center gap-2 text-[15px] font-semibold" style={{ color: '#35512A' }}>
                <ShieldCheck size={18} />
                已收到訂金，檔期已正式保留。
              </p>
              {paidAtLabel && (
                <p className="mt-2 text-[13px]" style={{ color: '#5F5648' }}>
                  付款完成時間：{paidAtLabel}
                </p>
              )}
            </div>
          )}

          {payment.state === 'expired' && (
            <div className="rounded-[20px] border border-[#F0D7D7] bg-[#FFF7F7] p-5">
              <p className="text-[15px] font-semibold" style={{ color: '#991B1B' }}>
                付款已逾期
              </p>
              <p className="mt-2 text-[14px] leading-[1.8]" style={{ color: '#5F5648' }}>
                如需重新保留檔期，請再聯繫我們重新確認日期與付款期限。
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
