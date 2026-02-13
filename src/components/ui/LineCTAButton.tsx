'use client'

import Button from './Button'
import { trackLineClick } from '@/lib/analytics'

interface LineCTAButtonProps {
  children: React.ReactNode
  location: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'primary' | 'secondary' | 'outline'
  className?: string
}

/**
 * LINE CTA Button with analytics tracking
 * Use this for prominent LINE CTA buttons (Hero, CTA sections, article bottom)
 * to ensure proper conversion tracking
 */
export default function LineCTAButton({
  children,
  location,
  size = 'lg',
  variant = 'primary',
  className,
}: LineCTAButtonProps) {
  const handleClick = () => {
    trackLineClick(location)
  }

  return (
    <Button
      href="https://line.me/R/ti/p/@037nyuwk"
      external
      size={size}
      variant={variant}
      className={className}
      onClick={handleClick}
    >
      {children}
    </Button>
  )
}
