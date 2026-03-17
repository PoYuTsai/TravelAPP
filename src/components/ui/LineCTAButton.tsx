'use client'

import Button from './Button'
import { trackLineClick } from '@/lib/analytics'
import { useSiteSettings } from '@/components/providers/SiteSettingsProvider'

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
  const siteSettings = useSiteSettings()
  const lineUrl = siteSettings.socialLinks.line

  const handleClick = () => {
    trackLineClick(location, lineUrl)
  }

  return (
    <Button
      href={lineUrl}
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
