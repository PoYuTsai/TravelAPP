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

import Footer from '@/components/Footer'

describe('Footer', () => {
  it('shows only the copyright line without the Claude Code credit', () => {
    const html = renderToStaticMarkup(<Footer />)

    expect(html).toContain('All rights reserved.')
    expect(html).not.toContain('Claude Code')
    expect(html).not.toContain('claude.ai/claude-code')
  })
})
