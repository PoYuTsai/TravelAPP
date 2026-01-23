'use client'

import Link from 'next/link'
import Image from 'next/image'
import { trackLineClick } from '@/lib/analytics'
import { footerNavLinks, legalLinks, socialLinks, LINE_URL } from '@/lib/navigation'
import { LineIcon, InstagramIcon, FacebookIcon, TikTokIcon } from '@/components/icons/SocialIcons'

// Map social link labels to icons
const socialIconMap: Record<string, React.ReactNode> = {
  LINE: <LineIcon className="w-5 h-5" />,
  Instagram: <InstagramIcon className="w-5 h-5" />,
  Facebook: <FacebookIcon className="w-5 h-5" />,
  TikTok: <TikTokIcon className="w-5 h-5" />,
}

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <div className="mb-4">
              <Image
                src="/images/logo.png"
                alt="清微旅行 Chiangway Travel"
                width={160}
                height={53}
                className="h-14 w-auto"
              />
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
              清邁親子自由行首選！我們是住在清邁的台泰夫妻，提供專業中文導遊、安全舒適的包車服務，為您的家庭打造難忘的清邁之旅。
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h3 className="font-bold text-lg mb-4">網站導覽</h3>
            <nav className="flex flex-col space-y-2">
              {footerNavLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-gray-400 hover:text-primary transition-colors text-sm"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Social & Contact */}
          <div>
            <h3 className="font-bold text-lg mb-4">聯繫我們</h3>
            <div className="flex space-x-4 mb-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-primary transition-colors"
                  aria-label={social.label}
                  onClick={social.label === 'LINE' ? () => trackLineClick('Footer - Social Icon') : undefined}
                >
                  {socialIconMap[social.label]}
                </a>
              ))}
            </div>
            <a
              href={LINE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-primary hover:bg-primary-dark text-black px-6 py-2 rounded-full font-medium transition-colors text-sm"
              onClick={() => trackLineClick('Footer - CTA Button')}
            >
              LINE 立即諮詢
            </a>
          </div>
        </div>

        {/* Legal Links & Copyright */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
          <div className="flex justify-center space-x-4 mb-4">
            {legalLinks.map((link, index) => (
              <span key={link.href} className="flex items-center gap-4">
                {index > 0 && <span>|</span>}
                <Link href={link.href} className="hover:text-primary transition-colors">
                  {link.label}
                </Link>
              </span>
            ))}
          </div>
          <p>&copy; {currentYear} 清微旅行 Chiangway Travel. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
