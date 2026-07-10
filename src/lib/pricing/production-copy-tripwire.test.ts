import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const PUBLIC_SOURCE_ROOTS = [
  // New public routes/components/pricing copy are picked up without maintaining a file list.
  'src/app',
  'src/components',
  'src/lib',
] as const

const PUBLIC_SOURCE_FILES = [
  // This production-facing Sanity schema lives outside the recursive roots above.
  'src/sanity/schemas/siteSettings.ts',
] as const

const EXCLUDED_PUBLIC_SOURCE_FILES = new Set([
  // Verified customer wording must stay verbatim; the rendering component remains scanned.
  'src/components/sections/testimonials-data.ts',
])

const EXCLUDED_PUBLIC_SOURCE_PREFIXES = [
  // LINE-agent workflows are internal; generated public artwork remains scanned.
  'src/lib/line-agent/',
] as const

interface ForbiddenCopy {
  label: string
  pattern: RegExp
}

const FORBIDDEN_COPY: ForbiddenCopy[] = [
  {
    label: '正面中文司機承諾',
    pattern: /中文司機|司機\s*(?:都|皆|也)?\s*(?:會|能|可以)\s*(?:說)?中文|司機(?:兼導遊)?\s*中文\s*(?:非常好|很好|流利|溝通(?:良好|順暢)?)|(?:會|能|可)(?:說)?中文(?:的)?司機|中文(?:流利|溝通)[^。；\n]{0,4}(?:的)?司機/g,
  },
  {
    label: '8 人與未證實法規綁定',
    pattern: /(?:8\s*人[^。；\n]{0,24}(?:依法|法規|法律)|(?:依法|法規|法律)[^。；\n]{0,24}8\s*人)/g,
  },
  {
    label: '司機與導遊各 THB 200 超時費',
    pattern: /各\s*(?:THB|泰銖)?\s*200|司機[^。；\n]{0,24}200[^。；\n]{0,36}導遊[^。；\n]{0,24}200/g,
  },
  {
    label: 'THB 400 每小時舊超時費',
    pattern: /(?:THB\s*)?400\s*(?:泰銖)?\s*[\/／]?\s*(?:小時|時)/g,
  },
  {
    label: '兒童座椅宣稱免費',
    pattern: /(?:兒童|嬰兒)(?:安全)?座椅[^。；\n]{0,20}免費|免費[^。；\n]{0,20}(?:兒童|嬰兒)(?:安全)?座椅/g,
  },
  {
    label: '兒童座椅列入標準包含',
    pattern: /包車服務包含[：:]?[\s\S]{0,420}(?:兒童|嬰兒)(?:安全)?座椅|(?:標準|基本)(?:服務|方案)?[^。；\n]{0,20}(?:包含|含)[^。；\n]{0,40}(?:兒童|嬰兒)(?:安全)?座椅/g,
  },
  {
    label: '現行包車 priceRange 使用 NT$ 舊價',
    pattern: /priceRange\s*:\s*['"`]\s*(?:NT\$|NTD|新台幣)/g,
  },
  {
    label: '現行包車 metadata 使用 NT$ 舊價',
    pattern: /(?:description|socialDescription)\s*:\s*['"`](?:[^'"`\n]{0,180}(?:NT\$|NTD|新台幣)[^'"`\n]{0,80}(?:包車|每人|每日)|[^'"`\n]{0,180}(?:包車|每人|每日)[^'"`\n]{0,80}(?:NT\$|NTD|新台幣))/g,
  },
]

function normalizePath(relativePath: string) {
  return relativePath.replace(/\\/g, '/')
}

function isPublicSourceFile(relativePath: string) {
  const normalized = normalizePath(relativePath)
  if (EXCLUDED_PUBLIC_SOURCE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return false
  }
  if (!/\.[cm]?[jt]sx?$/.test(normalized)) return false
  if (/(?:^|\/)(?:__tests__|__fixtures__)(?:\/|$)/.test(normalized)) return false
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized)) return false
  return !EXCLUDED_PUBLIC_SOURCE_FILES.has(normalized)
}

function discoverSourceFiles(relativeDirectory: string): string[] {
  return readdirSync(resolve(process.cwd(), relativeDirectory), { withFileTypes: true }).flatMap(
    (entry) => {
      const relativePath = normalizePath(`${relativeDirectory}/${entry.name}`)
      if (entry.isDirectory()) {
        return EXCLUDED_PUBLIC_SOURCE_PREFIXES.some((prefix) =>
          `${relativePath}/`.startsWith(prefix)
        )
          ? []
          : discoverSourceFiles(relativePath)
      }
      return isPublicSourceFile(relativePath) ? [relativePath] : []
    }
  )
}

function readPublicSources() {
  // Sanity internal tools and LINE-agent fixtures are outside these roots by design;
  // only the production-facing siteSettings schema is opted in explicitly.
  const relativePaths = Array.from(
    new Set([
      ...PUBLIC_SOURCE_ROOTS.flatMap(discoverSourceFiles),
      ...PUBLIC_SOURCE_FILES,
    ])
  ).sort()

  return relativePaths.map((relativePath) => ({
    relativePath,
    source: readFileSync(resolve(process.cwd(), relativePath), 'utf8'),
  }))
}

function sanitizeAllowedNegativeEducation(source: string) {
  return source
    .replace(
      /(?:不保證|無法保證|不能保證|不一定)(?:安排|提供)?(?:會(?:說)?中文的司機|中文司機)/g,
      '不承諾中文駕駛服務'
    )
    .replace(
      /(?:不保證|無法保證|不能保證)司機\s*(?:會|能|可以)\s*(?:說)?中文/g,
      '不承諾司機中文服務'
    )
    .replace(/(?:不是|並非)中文司機/g, '非中文服務司機')
    .replace(/司機會說中文嗎[？?]?/g, '司機中文服務說明')
}

function findViolations(relativePath: string, source: string) {
  const sanitizedSource = sanitizeAllowedNegativeEducation(source)

  return FORBIDDEN_COPY.flatMap(({ label, pattern }) => {
    const matches = Array.from(sanitizedSource.matchAll(new RegExp(pattern.source, pattern.flags)))
    return matches.map((match) => `${relativePath}: ${label}: ${match[0].replace(/\s+/g, ' ').trim()}`)
  })
}

describe('production public copy tripwire', () => {
  it('keeps retired driver, overtime, child-seat and NT$ promises out of current public sources', () => {
    const violations = readPublicSources().flatMap(({ relativePath, source }) =>
      findViolations(relativePath, source)
    )

    expect(violations).toEqual([])
  })

  it('recursively includes public routes, components and lib while isolating only review data and internal prefixes', () => {
    const paths = readPublicSources().map(({ relativePath }) => relativePath.replace(/\\/g, '/'))

    expect(paths).toContain('src/app/homestay/page.tsx')
    expect(paths).toContain('src/components/sections/ToursPreview.tsx')
    expect(paths).toContain('src/components/sections/Testimonials.tsx')
    expect(paths).toContain('src/lib/site-settings.ts')
    expect(paths).toContain('src/lib/quote/quoteDisplay.ts')
    expect(paths).not.toContain('src/components/sections/testimonials-data.ts')
    expect(paths).not.toContain('src/lib/line-agent/cases/auto-reply.ts')

    const testimonialsComponent = readFileSync(
      resolve(process.cwd(), 'src/components/sections/Testimonials.tsx'),
      'utf8',
    )
    expect(testimonialsComponent).not.toContain('司機兼導遊中文非常好')
  })

  it('catches positive Chinese-speaking-driver promises in alternate word order', () => {
    expect(findViolations('virtual-public-page.tsx', '保證會中文的司機全程服務')).toEqual([
      expect.stringContaining('正面中文司機承諾'),
    ])
    expect(findViolations('virtual-public-page.tsx', '不保證中文司機，標準安排為泰國司機')).toEqual([])
    expect(findViolations('virtual-public-page.tsx', '不保證會中文的司機，請使用 LINE 支援')).toEqual([])

    for (const promise of [
      '司機中文非常好',
      '司機兼導遊中文非常好',
      '司機中文流利',
    ]) {
      expect(findViolations('virtual-public-page.tsx', promise)).toEqual([
        expect.stringContaining('正面中文司機承諾'),
      ])
    }
  })
})
