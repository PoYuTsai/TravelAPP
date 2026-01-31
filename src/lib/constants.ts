/**
 * Shared constants used across the application
 */

// Blog category names (Chinese translations)
export const CATEGORY_NAMES: Record<string, string> = {
  guide: '攻略',
  attraction: '景點',
  food: '美食',
  transportation: '交通',
  practical: '實用',
  story: '故事',
} as const

// Get category display name with fallback
export function getCategoryName(category: string): string {
  return CATEGORY_NAMES[category] || category
}

// Brand info
export const BRAND = {
  name: '清微旅行',
  nameEn: 'Chiangway Travel',
  fullName: '清微旅行 Chiangway Travel',
  founders: {
    dad: 'Eric',
    mom: 'Min',
    daughter: 'Miya',
  },
  experience: {
    families: 114,
    rating: 5.0,
    minYearsLocal: 30, // Min's years in Chiang Mai
  },
} as const

// Revalidation times for ISR
export const REVALIDATE = {
  homepage: 60, // 1 minute
  blog: 60,
  tours: 60,
  services: 300, // 5 minutes
} as const
