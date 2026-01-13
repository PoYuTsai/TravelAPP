import { createClient } from 'next-sanity'
import { createImageUrlBuilder } from '@sanity/image-url'
import { projectId, dataset, apiVersion } from './config'

export const client = createClient({
  projectId,
  dataset,
  apiVersion,
  useCdn: true,
})

const builder = createImageUrlBuilder({ projectId, dataset })

export function urlFor(source: any) {
  return builder.image(source)
}
