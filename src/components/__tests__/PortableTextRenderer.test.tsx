/* eslint-disable @next/next/no-img-element */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    return <img alt={typeof props.alt === 'string' ? props.alt : ''} {...props} />
  },
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: Record<string, unknown>) => {
    return (
      <a href={typeof href === 'string' ? href : '#'} {...props}>
        {children}
      </a>
    )
  },
}))

import PortableTextRenderer from '@/components/blog/PortableTextRenderer'

describe('PortableTextRenderer', () => {
  it('links recommended tours to the canonical detail page instead of a hash anchor', () => {
    const html = renderToStaticMarkup(
      <PortableTextRenderer
        content={[
          {
            _key: 'tours-block-1',
            _type: 'toursBlock',
            title: '推薦行程',
            tours: [
              {
                title: '清邁親子經典 6 天 5 夜',
                slug: { current: 'family-classic-6d' },
                excerpt: '以親子節奏安排的清邁客製行程。',
              },
            ],
          },
        ] as any}
      />
    )

    expect(html).toContain('href="/tours/family-classic-6d"')
    expect(html).not.toContain('href="/tours#family-classic-6d"')
  })
})
