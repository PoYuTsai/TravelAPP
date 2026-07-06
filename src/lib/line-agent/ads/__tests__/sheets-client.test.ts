import { createSheetsClient } from '../sheets-client'

const SA = JSON.stringify({ client_email: 'sa@proj.iam.gserviceaccount.com', private_key: 'unused-in-this-test' })

function fakeTransport(calls: any[]) {
  return async (url: any, init: any) => {
    calls.push({ url: String(url), init })
    if (String(url).includes('oauth2.googleapis.com/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'ya29.fake', expires_in: 3600 }) } as any
    }
    return { ok: true, status: 200, json: async () => ({ updates: { updatedRows: 1 } }) } as any
  }
}

describe('createSheetsClient.appendRows', () => {
  it('exchanges JWT for token then appends rows via REST', async () => {
    const calls: any[] = []
    const client = createSheetsClient({
      transport: fakeTransport(calls),
      serviceAccountJson: SA,
      now: () => 1_720_000_000_000,
      signAssertion: async () => 'header.payload.sig',
    })
    await client.appendRows('SHEET_ID', '轉換!A1', [['2026-07-06', '清邁包車', '4', '18000', '2026-07-05', '', '', '自動']])

    const tokenCall = calls.find((c) => c.url.includes('oauth2'))
    expect(tokenCall.init.body).toContain('assertion=header.payload.sig')
    const appendCall = calls.find((c) => c.url.includes('/values/'))
    expect(appendCall.url).toContain('/SHEET_ID/values/')
    expect(appendCall.url).toContain(':append')
    expect(appendCall.url).toContain('valueInputOption=USER_ENTERED')
    expect(appendCall.init.headers.Authorization).toBe('Bearer ya29.fake')
    expect(JSON.parse(appendCall.init.body)).toEqual({ values: [['2026-07-06', '清邁包車', '4', '18000', '2026-07-05', '', '', '自動']] })
  })

  it('throws a non-minified error when append fails', async () => {
    const transport = async (url: any) =>
      String(url).includes('oauth2')
        ? ({ ok: true, status: 200, json: async () => ({ access_token: 't' }) } as any)
        : ({ ok: false, status: 403, text: async () => 'PERMISSION_DENIED: sheet not shared' } as any)
    const client = createSheetsClient({ transport, serviceAccountJson: SA, signAssertion: async () => 's' })
    await expect(client.appendRows('S', 'A1', [['x']])).rejects.toThrow(/403.*PERMISSION_DENIED/)
  })
})

describe('defaultSignAssertion (real crypto smoke)', () => {
  it('signs a real three-segment JWT via the default sign path', async () => {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    )
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey))
    let raw = ''
    for (const b of pkcs8) raw += String.fromCharCode(b)
    const b64 = btoa(raw)
    const pem = `-----BEGIN PRIVATE KEY-----\n${(b64.match(/.{1,64}/g) ?? []).join('\n')}\n-----END PRIVATE KEY-----\n`
    const realSA = JSON.stringify({ client_email: 'sa@proj.iam.gserviceaccount.com', private_key: pem })

    const calls: any[] = []
    const client = createSheetsClient({
      transport: fakeTransport(calls),
      serviceAccountJson: realSA,
      // no signAssertion → exercise defaultSignAssertion + Web Crypto RS256
    })
    await client.appendRows('SHEET_ID', 'A1', [['x']])

    const tokenCall = calls.find((c) => c.url.includes('oauth2'))
    const m = /assertion=([^&]+)/.exec(tokenCall.init.body)
    expect(m).not.toBeNull()
    const assertion = m![1]
    const segments = assertion.split('.')
    expect(segments).toHaveLength(3)
    for (const seg of segments) expect(seg.length).toBeGreaterThan(0)
  })
})
