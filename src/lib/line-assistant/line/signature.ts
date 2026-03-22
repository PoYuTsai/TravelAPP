import { createHmac, timingSafeEqual } from 'crypto'

export function createLineSignature(rawBody: string, channelSecret: string): string {
  return createHmac('sha256', channelSecret).update(rawBody).digest('base64')
}

export function verifyLineSignature(input: {
  rawBody: string
  signature: string | null
  channelSecret: string
}): boolean {
  if (!input.signature) {
    return false
  }

  const expectedSignature = createLineSignature(input.rawBody, input.channelSecret)

  try {
    const expectedBuffer = Buffer.from(expectedSignature)
    const actualBuffer = Buffer.from(input.signature)

    if (expectedBuffer.length !== actualBuffer.length) {
      return false
    }

    return timingSafeEqual(expectedBuffer, actualBuffer)
  } catch {
    return false
  }
}
