// src/lib/line-agent/ads/sheets-client.ts
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
const JWT_GRANT = 'urn:ietf:params:oauth:grant-type:jwt-bearer'

export type SheetCell = string | number

export interface SheetsClient {
  appendRows(spreadsheetId: string, range: string, rows: SheetCell[][]): Promise<void>
}

interface ServiceAccount { client_email: string; private_key: string }

export interface SheetsClientDeps {
  transport: typeof fetch
  serviceAccountJson: string
  now?: () => number
  /** 注入 seam：預設用 Web Crypto RS256 簽 JWT；測試可換 fake 避開 crypto。 */
  signAssertion?: (sa: ServiceAccount, nowSec: number) => Promise<string>
}

function base64url(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
// TS 5.7 的 lib.dom 把 BufferSource 收緊成 ArrayBuffer-backed；TextEncoder 於 runtime 永遠
// 產出真 ArrayBuffer（非 SharedArrayBuffer），故此處收斂型別讓 crypto.subtle.sign 接受。
function utf8(s: string): Uint8Array<ArrayBuffer> { return new TextEncoder().encode(s) as Uint8Array<ArrayBuffer> }

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem.replace(/-----BEGIN PRIVATE KEY-----/, '').replace(/-----END PRIVATE KEY-----/, '').replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
}

async function defaultSignAssertion(sa: ServiceAccount, nowSec: number): Promise<string> {
  const header = base64url(utf8(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claim = base64url(utf8(JSON.stringify({
    iss: sa.client_email, scope: SHEETS_SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600,
  })))
  const key = await importPrivateKey(sa.private_key)
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, utf8(`${header}.${claim}`))
  return `${header}.${claim}.${base64url(new Uint8Array(sig))}`
}

export function createSheetsClient(deps: SheetsClientDeps): SheetsClient {
  const sign = deps.signAssertion ?? defaultSignAssertion
  const nowMs = () => deps.now?.() ?? Date.now()

  async function getAccessToken(): Promise<string> {
    const sa = JSON.parse(deps.serviceAccountJson) as ServiceAccount
    const assertion = await sign(sa, Math.floor(nowMs() / 1000))
    const res = await deps.transport(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=${encodeURIComponent(JWT_GRANT)}&assertion=${assertion}`,
    })
    if (!res.ok) throw new Error(`Sheets token exchange failed: ${res.status} ${await res.text()}`)
    const json = (await res.json()) as { access_token?: string }
    if (!json.access_token) throw new Error('Sheets token exchange: missing access_token')
    return json.access_token
  }

  return {
    async appendRows(spreadsheetId, range, rows) {
      const token = await getAccessToken()
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED`
      const res = await deps.transport(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: rows }),
      })
      if (!res.ok) throw new Error(`Sheets append failed: ${res.status} ${await res.text()}`)
    },
  }
}
