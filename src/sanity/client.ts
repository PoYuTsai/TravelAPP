import { createClient } from 'next-sanity'
import { createImageUrlBuilder } from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url'
import { projectId, dataset, apiVersion } from './config'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: process.env.NODE_ENV === 'production', // 生產環境啟用 CDN 快取
})

const builder = createImageUrlBuilder({ projectId, dataset })

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}
