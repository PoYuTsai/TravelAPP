/* eslint-disable @next/next/no-img-element */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => (
    <img
      alt={typeof props.alt === 'string' ? props.alt : ''}
      src={typeof props.src === 'string' ? props.src : undefined}
    />
  ),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: Record<string, unknown>) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>{children as React.ReactNode}</a>
  ),
}))

vi.mock('@/sanity/client', () => ({
  urlFor: () => ({ width: () => ({ height: () => ({ url: () => '/test.webp' }) }) }),
}))

import Hero from '@/components/sections/Hero'
import WhoWeAre from '@/components/sections/WhoWeAre'
import WhyUs from '@/components/sections/WhyUs'
import Services from '@/components/sections/Services'
import CTA from '@/components/sections/CTA'

function copyOf(node: React.ReactElement) {
  return renderToStaticMarkup(node).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
}

describe('public service-copy fallbacks', () => {
  it('keeps Hero, WhoWeAre and CTA on code-owned canonical promises', () => {
    const hero = copyOf(<Hero />)
    const who = copyOf(<WhoWeAre />)
    const cta = copyOf(<CTA />)

    expect(hero).toContain('標準服務由泰國司機駕駛')
    expect(hero).toContain('LINE 中文支援')
    expect(hero).toContain('中文導遊依需求選配')
    expect(who).toContain('標準泰國司機通常不以中文服務')
    expect(who).toContain('行程事先確認，旅途中提供 LINE 中文支援')
    expect(who).toContain('中文導遊依需求選配')
    expect(cta).toContain('安排標準泰國司機與 LINE 中文支援')
    expect(cta).toContain('需要時再選配中文導遊')
  })

  it('keeps WhyUs and Services explicit about optional guide, paid seats and THB pricing', () => {
    const why = copyOf(<WhyUs />)
    const services = copyOf(<Services />)

    expect(why).toContain('標準泰國司機')
    expect(why).toContain('LINE 中文支援')
    expect(why).toContain('中文導遊依需求選配')
    expect(services).toContain('每人每日 THB 750 起')
    expect(services).toContain('兒童安全座椅為 THB 500／日／張')
    expect(services).toContain('每位乘客（含嬰幼兒）各佔一席')
    expect(services).toContain('不另加算一人')
    expect(services).toContain('需納入車內座位配置')
    expect(services).not.toContain('且佔一個座位')
    expect(services).not.toContain('每日 NT$ 3,700 起')
    expect(services).not.toContain('專屬司機 + 中文導遊')
  })
})
