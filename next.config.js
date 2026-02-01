/** @type {import('next').NextConfig} */
const nextConfig = {
  // www to non-www redirect (SEO: 統一網域)
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.chiangway-travel.com' }],
        destination: 'https://chiangway-travel.com/:path*',
        permanent: true, // 301 redirect
      },
    ]
  },

  images: {
    // 啟用 AVIF 和 WebP 格式自動優化
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
    ],
    // 設定裝置尺寸
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Security Headers
  async headers() {
    // Allowed origins for CORS (production domain + localhost for dev)
    const allowedOrigins = [
      'https://chiangway-travel.com',
      'https://www.chiangway-travel.com',
      process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
    ].filter(Boolean).join(', ')

    return [
      // CORS headers for API routes
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: allowedOrigins },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-API-Key' },
          { key: 'Access-Control-Max-Age', value: '86400' }, // 24 hours preflight cache
        ],
      },
      // Sanity Studio 需要較寬鬆的 CSP (unsafe-eval)
      {
        source: '/studio',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://cdn.sanity.io https://*.sanity.io",
              "connect-src 'self' https://*.sanity.io wss://*.sanity.io https://www.google-analytics.com",
              "frame-src 'self'",
              "media-src 'self' https://cdn.sanity.io",
            ].join('; '),
          },
        ],
      },
      {
        source: '/studio/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://cdn.sanity.io https://*.sanity.io",
              "connect-src 'self' https://*.sanity.io wss://*.sanity.io https://www.google-analytics.com",
              "frame-src 'self'",
              "media-src 'self' https://cdn.sanity.io",
            ].join('; '),
          },
        ],
      },
      // Security headers for all routes
      {
        source: '/(.*)',
        headers: [
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'DENY' },
          // Force HTTPS (HSTS with preload for maximum security)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // XSS protection for older browsers
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // Control referrer information
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Content Security Policy (開發模式加入 unsafe-eval 給 Sanity Studio)
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''} https://www.googletagmanager.com https://www.google-analytics.com`,
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://cdn.sanity.io https://img.youtube.com https://www.google-analytics.com https://res.cloudinary.com",
              "connect-src 'self' https://www.google-analytics.com https://*.sanity.io https://res.cloudinary.com",
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
              "media-src 'self' https://cdn.sanity.io https://res.cloudinary.com",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
