import { describe, expect, it, vi } from 'vitest'
import { createCachedLoader } from '../partner-group/cached-loader'

describe('createCachedLoader', () => {
  it('TTL 內重用快取（load 只跑一次）', async () => {
    let t = 0
    const load = vi.fn(async () => 'v1')
    const get = createCachedLoader({ load, ttlMs: 1000, now: () => t })
    expect(await get()).toBe('v1')
    t = 999
    expect(await get()).toBe('v1')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('TTL 到期（>=）重新 load', async () => {
    let t = 0
    let n = 0
    const load = vi.fn(async () => `v${++n}`)
    const get = createCachedLoader({ load, ttlMs: 1000, now: () => t })
    expect(await get()).toBe('v1')
    t = 1000
    expect(await get()).toBe('v2')
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('single-flight：併發呼叫 join 同一次 load', async () => {
    let resolve!: (v: string) => void
    const load = vi.fn(
      () => new Promise<string>((r) => { resolve = r })
    )
    const get = createCachedLoader({ load, ttlMs: 1000, now: () => 0 })
    const [a, b] = [get(), get()]
    resolve('shared')
    expect(await a).toBe('shared')
    expect(await b).toBe('shared')
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('load 失敗：error 上拋且不快取 — 下一次重試', async () => {
    let n = 0
    const load = vi.fn(async () => {
      if (++n === 1) throw new Error('boom')
      return 'recovered'
    })
    const get = createCachedLoader({ load, ttlMs: 1000, now: () => 0 })
    await expect(get()).rejects.toThrow('boom')
    expect(await get()).toBe('recovered')
  })
})
