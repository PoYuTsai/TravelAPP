export interface IdempotencyStore {
  has(key: string): Promise<boolean>
  markProcessed(key: string, ttlSeconds?: number): Promise<void>
  claim(key: string, ttlSeconds?: number): Promise<boolean>
}

export function buildIdempotencyKey(namespace: string, value: string): string {
  return `${namespace}:${value}`
}

export function createMemoryIdempotencyStore(): IdempotencyStore {
  const store = new Map<string, number>()

  const cleanup = () => {
    const now = Date.now()
    for (const [key, expiresAt] of store.entries()) {
      if (expiresAt <= now) {
        store.delete(key)
      }
    }
  }

  const getExpiresAt = (ttlSeconds: number = 3600) => Date.now() + ttlSeconds * 1000

  return {
    async has(key) {
      cleanup()
      return store.has(key)
    },
    async markProcessed(key, ttlSeconds = 3600) {
      cleanup()
      store.set(key, getExpiresAt(ttlSeconds))
    },
    async claim(key, ttlSeconds = 3600) {
      cleanup()
      if (store.has(key)) {
        return false
      }
      store.set(key, getExpiresAt(ttlSeconds))
      return true
    },
  }
}
