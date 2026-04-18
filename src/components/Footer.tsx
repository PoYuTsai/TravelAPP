'use client'

import Link from 'next/link'
import Image from 'next/image'
import { trackLineClick } from '@/lib/analytics'
import { footerNavLinks, legalLinks, socialLinks } from '@/lib/navigation'
import { CATEGORY_NAMES } from '@/lib/constants'
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
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
              爸媽開的清邁親子包車。台灣爸爸 Eric × 泰國媽媽 Min，司機導遊專業分工，專為帶小孩的家庭設計，深受台灣家庭信賴。
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

          {/* Blog Categories */}
          <div>
            <h3 className="font-bold text-lg mb-4">部落格分類</h3>
            <nav className="flex flex-col space-y-2">
              {Object.entries(CATEGORY_NAMES).map(([key, label]) => (
                <Link
                  key={key}
                  href={`/blog/category/${key}`}
                  className="text-gray-400 hover:text-primary transition-colors text-sm"
                >
                  {label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Social & Contact */}
          <div>
            <h3 className="font-bold text-lg mb-4">聯繫我們</h3>
            <div className="flex space-x-2 mb-4">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-gray-400 hover:text-primary transition-colors"
                  aria-label={social.label}
                  onClick={social.label === 'LINE' ? () => trackLineClick('Footer - Social Icon') : undefined}
                >
                  {socialIconMap[social.label]}
                </a>
              ))}
            </div>
            <address className="not-italic text-gray-400 text-sm space-y-1">
              <p>
                📍 <a
                  href="https://share.google/p6anNFwTvi9Sc7JAt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary transition-colors"
                >
                  444, Wiang, Fang District, Chiang Mai 50110
                </a>
              </p>
              <p>
                📞 <a href="tel:+886987591322" className="hover:text-primary transition-colors">+886 987-591-322</a>
                <span className="text-gray-600">（台灣）</span>
              </p>
              <p>
                📞 <a href="tel:+66637900666" className="hover:text-primary transition-colors">+66 63-790-0666</a>
                <span className="text-gray-600">（泰國）</span>
              </p>
            </address>
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
