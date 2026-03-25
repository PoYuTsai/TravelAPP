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

import AuthorCard from '@/components/blog/AuthorCard'

describe('AuthorCard', () => {
  it('reinforces the brand and core service with a homepage link', () => {
    const html = renderToStaticMarkup(<AuthorCard />)

    expect(html).toContain('清微旅行')
    expect(html).toContain('清邁親子包車')
    expect(html).toContain('href="/"')
  })
})
