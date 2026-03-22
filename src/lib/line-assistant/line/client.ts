import type { LineAssistantConfig } from '../types'

export interface LineProfile {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

export function createLineApiClient(config: LineAssistantConfig) {
  const headers = {
    Authorization: `Bearer ${config.line.channelAccessToken}`,
  }

  return {
    async getUserProfile(userId: string): Promise<LineProfile | null> {
      const response = await fetch(`https://api.line.me/v2/bot/profile/${userId}`, {
        headers,
      })

      if (!response.ok) {
        return null
      }

      return (await response.json()) as LineProfile
    },
  }
}
