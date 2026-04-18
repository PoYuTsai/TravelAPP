import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '清微旅行 Chiangway Travel',
    short_name: '清微旅行',
    description: '爸媽開的清邁親子包車。台灣爸爸 Eric × 泰國媽媽 Min 經營，深受台灣家庭信賴。',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#FFD700',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    categories: ['travel', 'tourism', 'family'],
    lang: 'zh-TW',
  }
}
