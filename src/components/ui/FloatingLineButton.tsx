'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { trackLineClick } from '@/lib/analytics'
import { LINE_URL } from '@/lib/navigation'

// LINE icon
function LineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  )
}

interface FloatingLineButtonProps {
  lineUrl?: string
}

export default function FloatingLineButton({
  lineUrl = LINE_URL
}: FloatingLineButtonProps) {
  const [isVisible, setIsVisible] = useState(false)
  const pathname = usePathname()

  // 在文章頁面隱藏浮動按鈕（已有底部 CTA 和 Footer）
  const isBlogArticlePage = pathname?.startsWith('/blog/') && pathname !== '/blog/'

  useEffect(() => {
    // 文章頁直接隱藏
    if (isBlogArticlePage) {
      setIsVisible(false)
      return
    }

    const handleScroll = () => {
      const scrollY = window.scrollY
      const windowHeight = window.innerHeight
      const documentHeight = document.documentElement.scrollHeight

      // Show button after scrolling 300px
      const hasScrolledEnough = scrollY > 300

      // Hide when near bottom (within 200px of footer)
      const isNearBottom = scrollY + windowHeight > documentHeight - 200

      setIsVisible(hasScrolledEnough && !isNearBottom)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => window.removeEventListener('scroll', handleScroll)
  }, [isBlogArticlePage])

  const handleClick = () => {
    trackLineClick('Floating LINE Button')
  }

  return (
    <a
      href={lineUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      id="floating-line-button"
      className={`
        fixed bottom-20 right-4 z-50
        flex items-center gap-2
        bg-[#06C755] hover:bg-[#05b34d]
        text-white font-medium
        px-4 py-3 rounded-full
        shadow-lg hover:shadow-xl
        transition-all duration-300 ease-out
        ${isVisible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-16 opacity-0 scale-90 pointer-events-none'}
        active:scale-95
        md:bottom-8 md:right-6
      `}
      aria-label="LINE 聯繫我們"
    >
      <LineIcon className="w-6 h-6" />
      <span className="text-sm font-medium whitespace-nowrap">LINE 聊聊</span>
    </a>
  )
}
