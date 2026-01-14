'use client'

import Link from 'next/link'
import { trackLineClick } from '@/lib/analytics'

interface ButtonProps {
  children: React.ReactNode
  href?: string
  variant?: 'primary' | 'secondary' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  external?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  onClick?: () => void
}

export default function Button({
  children,
  href,
  variant = 'primary',
  size = 'md',
  className = '',
  external = false,
  type = 'button',
  disabled = false,
  onClick,
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full transition-colors'
  const variantStyles = {
    primary: 'bg-primary hover:bg-primary-dark text-black',
    secondary: 'bg-gray-900 hover:bg-gray-800 text-white',
    outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-black',
  }
  const sizeStyles = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  }
  const styles = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`

  // 檢查是否為 LINE 連結
  const isLineLink = href?.includes('line.me')

  // 處理點擊事件（追蹤 LINE 點擊）
  const handleClick = () => {
    if (isLineLink) {
      // 從按鈕文字取得位置標籤
      const buttonText = typeof children === 'string' ? children : 'LINE Button'
      trackLineClick(buttonText)
    }
    onClick?.()
  }

  if (href) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={styles}
          onClick={handleClick}
        >
          {children}
        </a>
      )
    }
    return (
      <Link href={href} className={styles} onClick={handleClick}>
        {children}
      </Link>
    )
  }

  const disabledStyles = disabled ? 'opacity-50 cursor-not-allowed' : ''
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      className={`${styles} ${disabledStyles}`}
    >
      {children}
    </button>
  )
}
