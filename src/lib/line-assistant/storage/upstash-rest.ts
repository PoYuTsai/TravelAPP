type FetchLike = typeof fetch

interface UpstashResponse<T> {
  result: T
}

function encodeSegments(segments: Array<string | number>): string {
  return segments.map((segment) => encodeURIComponent(String(segment))).join('/')
}

export function createUpstashRestClient(input: {
  baseUrl: string
  token: string
  fetchImpl?: FetchLike
}) {
  const fetchImpl = input.fetchImpl ?? fetch

  async function request<T>(
    segments: Array<string | number>,
    init: { method?: 'GET' | 'POST'; body?: string } = {}
  ): Promise<T> {
    const response = await fetchImpl(`${input.baseUrl}/${encodeSegments(segments)}`, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${input.token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body,
    })

    if (!response.ok) {
      throw new Error(`KV request failed with status ${response.status}`)
    }

    const payload = (await response.json()) as UpstashResponse<T>
    return payload.result
  }

  return {
    async getJson<T>(key: string): Promise<T | null> {
      const raw = await request<string | null>(['get', key])
      if (!raw) return null
      return JSON.parse(raw) as T
    },
    async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
      const segments: Array<string | number> = ['set', key]
      if (ttlSeconds) {
        segments.push('EX', ttlSeconds)
      }
      await request<string>(segments, {
        method: 'POST',
        body: JSON.stringify(value),
      })
    },
    async getText(key: string): Promise<string | null> {
      return request<string | null>(['get', key])
    },
    async setText(key: string, value: string, ttlSeconds?: number): Promise<void> {
      const segments: Array<string | number> = ['set', key, value]
      if (ttlSeconds) {
        segments.push('EX', ttlSeconds)
      }
      await request<string>(segments)
    },
    async claim(key: string, ttlSeconds: number): Promise<boolean> {
      const result = await request<string | null>(['set', key, '1', 'NX', 'EX', ttlSeconds])
      return result === 'OK'
    },
    async delete(key: string): Promise<void> {
      await request<number>(['del', key])
    },
    async scanKeys(prefix: string): Promise<string[]> {
      const allKeys: string[] = []
      let cursor = '0'

      do {
        const result = await request<[string, string[]]>([
          'scan',
          cursor,
          'MATCH',
          `${prefix}*`,
          'COUNT',
          100,
        ])
        cursor = result[0]
        allKeys.push(...result[1])
      } while (cursor !== '0')

      return allKeys
    },
    async mgetJson<T>(keys: string[]): Promise<T[]> {
      if (keys.length === 0) {
        return []
      }

      const rawValues = await request<Array<string | null>>(['mget', ...keys])
      return rawValues
        .filter((value): value is string => typeof value === 'string')
        .map((value) => JSON.parse(value) as T)
    },
  }
}
