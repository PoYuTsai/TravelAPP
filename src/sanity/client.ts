import { createClient } from 'next-sanity'
import { createImageUrlBuilder } from '@sanity/image-url'
import type { SanityImageSource } from '@sanity/image-url'
import { projectId, dataset, apiVersion } from './config'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: false, // 開發時用 false，上線改 true
})

const builder = createImageUrlBuilder({ projectId, dataset })

export function urlFor(source: SanityImageSource) {
  return builder.image(source)
}
