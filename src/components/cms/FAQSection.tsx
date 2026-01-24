'use client'

import { useState } from 'react'

interface FAQItem {
  question: string
  answer: string
}

interface FAQSectionProps {
  items: FAQItem[]
  schemaType?: 'FAQPage' | 'none'
}

export default function FAQSection({ items, schemaType = 'FAQPage' }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  if (!items || items.length === 0) return null

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  // Generate FAQ Schema for SEO
  const faqSchema = schemaType === 'FAQPage' ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  } : null

  return (
    <>
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}
      <div className="space-y-4">
        {items.map((item, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggle(index)}
              className="w-full flex items-center justify-between p-4 md:p-5 text-left bg-white hover:bg-gray-50 transition-colors"
              aria-expanded={openIndex === index}
              aria-controls={`faq-answer-${index}`}
            >
              <span className="font-medium text-gray-900 pr-4">
                {item.question}
              </span>
              <svg
                className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${
                  openIndex === index ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {openIndex === index && (
              <div
                id={`faq-answer-${index}`}
                className="p-4 md:p-5 pt-0 md:pt-0 bg-white"
              >
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                  {item.answer}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
