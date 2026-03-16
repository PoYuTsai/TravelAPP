import { createClient } from 'next-sanity'
import { projectId, dataset } from '@/sanity/config'

const SANITY_AUTH_API_VERSION = '2021-06-07'

interface SanityCurrentUser {
  id: string
  name?: string
  email?: string
}

export async function getSanityCurrentUser(token: string): Promise<SanityCurrentUser | null> {
  const trimmedToken = token.trim()
  if (!trimmedToken) {
    return null
  }

  const client = createClient({
    projectId,
    dataset,
    apiVersion: SANITY_AUTH_API_VERSION,
    useCdn: false,
    token: trimmedToken,
  })

  try {
    const user = await client.request<SanityCurrentUser>({
      uri: '/users/me',
      tag: 'users.get-current',
    })

    return typeof user?.id === 'string' ? user : null
  } catch {
    return null
  }
}
