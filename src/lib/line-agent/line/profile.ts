import type { AgentCase } from '@/lib/line-agent/cases/case-state'
import type { CustomerDisplayNameResolver } from '@/lib/line-agent/commands/handlers'

const LINE_PROFILE_ENDPOINT = 'https://api.line.me/v2/bot/profile'

export interface FetchLineProfileDisplayNameOptions {
  lineUserId: string
  channelAccessToken: string
  fetchImpl?: typeof fetch
}

export async function fetchLineProfileDisplayName({
  lineUserId,
  channelAccessToken,
  fetchImpl = fetch,
}: FetchLineProfileDisplayNameOptions): Promise<string | null> {
  const token = channelAccessToken.trim()
  if (!token || !lineUserId.trim()) return null

  try {
    const response = await fetchImpl(
      `${LINE_PROFILE_ENDPOINT}/${encodeURIComponent(lineUserId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!response.ok) return null

    const payload = (await response.json()) as { displayName?: unknown }
    const displayName = typeof payload.displayName === 'string' ? payload.displayName.trim() : ''
    return displayName || null
  } catch {
    return null
  }
}

export function createLineProfileDisplayNameResolver(options: {
  channelAccessToken?: string
  fetchImpl?: typeof fetch
}): CustomerDisplayNameResolver {
  return async (agentCase: AgentCase): Promise<string | null> =>
    fetchLineProfileDisplayName({
      lineUserId: agentCase.lineUserId,
      channelAccessToken: options.channelAccessToken ?? '',
      fetchImpl: options.fetchImpl,
    })
}
