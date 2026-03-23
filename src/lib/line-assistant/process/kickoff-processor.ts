type FetchLike = typeof fetch

export type KickoffLineWebhookProcessorResult =
  | {
      status: 'skipped'
      reason: 'no_accepted_events' | 'missing_cron_secret'
    }
  | {
      status: 'started'
      processUrl: string
    }

export async function kickoffLineWebhookProcessor(input: {
  acceptedCount: number
  requestUrl: string
  cronSecret: string | null
  siteUrl?: string | null
  fetchImpl?: FetchLike
}): Promise<KickoffLineWebhookProcessorResult> {
  if (input.acceptedCount <= 0) {
    return {
      status: 'skipped',
      reason: 'no_accepted_events',
    }
  }

  if (!input.cronSecret) {
    return {
      status: 'skipped',
      reason: 'missing_cron_secret',
    }
  }

  const baseUrl = input.siteUrl?.trim() || new URL(input.requestUrl).origin
  const processUrl = new URL('/api/line-webhook/process', baseUrl).toString()
  const fetchImpl = input.fetchImpl ?? fetch

  const response = await fetchImpl(processUrl, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.cronSecret}`,
      'content-type': 'application/json',
      'x-line-assistant-trigger': 'line-webhook',
    },
    body: JSON.stringify({
      limit: 20,
    }),
  })

  if (!response.ok) {
    throw new Error(`LINE webhook processor kickoff failed with status ${response.status}`)
  }

  return {
    status: 'started',
    processUrl,
  }
}
