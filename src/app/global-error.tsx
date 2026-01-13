'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-TW">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>發生嚴重錯誤</h1>
            <p style={{ color: '#666', marginBottom: '2rem' }}>
              抱歉，網站發生問題。請稍後再試。
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: '#F7C009',
                color: 'black',
                padding: '0.75rem 1.5rem',
                borderRadius: '9999px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 500
              }}
            >
              重新整理
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
