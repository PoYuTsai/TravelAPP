'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'

const navLinks = [
  { href: '/', label: '首頁' },
  { href: '/about', label: '關於我們' },
  { href: '/tours', label: '行程介紹' },
  { href: '/blog', label: '部落格' },
  { href: '/contact', label: '聯繫我們' },
]

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header className="bg-white shadow-sm fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className={`flex justify-between items-center transition-all duration-300 ${isScrolled ? 'h-14' : 'h-16'}`}>
          {/* Logo - hides when scrolled */}
          <Link
            href="/"
            className={`flex items-center transition-all duration-300 ${isScrolled ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}
          >
            <Image
              src="/images/logo.png"
              alt="清微旅行 Chiangway Travel"
              width={160}
              height={53}
              className="h-14 w-auto"
              priority
            />
          </Link>

          {/* Desktop Navigation - always visible, moves left when logo hides */}
          <nav className={`hidden md:flex items-center space-x-8 transition-all duration-300 ${isScrolled ? 'flex-1 justify-start' : ''}`}>
            {/* Mini logo when scrolled */}
            {isScrolled && (
              <Link href="/" className="mr-4">
                <Image
                  src="/images/logo.png"
                  alt="清微旅行"
                  width={100}
                  height={33}
                  className="h-8 w-auto"
                />
              </Link>
            )}
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-600 hover:text-primary transition-colors font-medium"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="https://line.me/R/ti/p/@037nyuwk"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary hover:bg-primary-dark text-black px-6 py-2 rounded-full font-medium transition-colors"
            >
              LINE 諮詢
            </a>
          </nav>

          {/* Mobile: Mini logo when scrolled */}
          {isScrolled && (
            <Link href="/" className="md:hidden">
              <Image
                src="/images/logo.png"
                alt="清微旅行"
                width={100}
                height={33}
                className="h-8 w-auto"
              />
            </Link>
          )}

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-gray-600"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t">
            <nav className="flex flex-col space-y-4">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-gray-600 hover:text-primary transition-colors font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <a
                href="https://line.me/R/ti/p/@037nyuwk"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-primary hover:bg-primary-dark text-black px-6 py-2 rounded-full font-medium transition-colors text-center"
              >
                LINE 諮詢
              </a>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
