const RESTRICTED_STUDIO_EMAILS = new Set([
  'lyc32580@gmail.com',
  'moon12sun20@yahoo.com.tw',
])

const RESTRICTED_TOOL_NAMES = ['structure', 'pricing-formal'] as const
const FULL_TOOL_NAMES = ['structure', 'dashboard', 'accounting', 'pricing', 'pricing-formal'] as const

const STUDIO_TOOL_TITLES = {
  structure: 'Structure',
  dashboard: 'Dashboard 測試1',
  accounting: 'Calculate 測試2',
  pricing: '報價計算測試v1',
  'pricing-formal': '報價計算(正式版)',
} as const

export function normalizeStudioEmail(email?: string | null): string {
  return email?.trim().toLowerCase() ?? ''
}

export function isRestrictedStudioEmail(email?: string | null): boolean {
  return RESTRICTED_STUDIO_EMAILS.has(normalizeStudioEmail(email))
}

export function getVisibleStudioToolNames(email?: string | null): string[] {
  return isRestrictedStudioEmail(email)
    ? [...RESTRICTED_TOOL_NAMES]
    : [...FULL_TOOL_NAMES]
}

export function getStudioToolTitle(name: string): string {
  return STUDIO_TOOL_TITLES[name as keyof typeof STUDIO_TOOL_TITLES] ?? name
}

export function customizeStudioTools<T extends { name: string; title?: string }>(
  tools: T[],
  email?: string | null
): T[] {
  const allowedNames = new Set(getVisibleStudioToolNames(email))

  return tools
    .filter((tool) => allowedNames.has(tool.name))
    .map((tool) => ({
      ...tool,
      title: getStudioToolTitle(tool.name),
    }))
}
