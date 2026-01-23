'use client'

import { useEffect } from 'react'
import Head from 'next/head'

export default function ApiDocsPage() {
  useEffect(() => {
    // Load Swagger UI CSS
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css'
    document.head.appendChild(link)

    // Load Swagger UI Bundle
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js'
    script.onload = () => {
      // @ts-expect-error SwaggerUIBundle is loaded from CDN
      window.SwaggerUIBundle({
        url: '/api/openapi',
        dom_id: '#swagger-ui',
        presets: [
          // @ts-expect-error SwaggerUIBundle is loaded from CDN
          window.SwaggerUIBundle.presets.apis,
        ],
        layout: 'BaseLayout',
        deepLinking: true,
      })
    }
    document.body.appendChild(script)

    return () => {
      document.head.removeChild(link)
      document.body.removeChild(script)
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gray-900 text-white py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold">Chiangway Travel API</h1>
          <p className="text-gray-400 mt-1">內部 API 文件</p>
        </div>
      </div>

      {/* Swagger UI Container */}
      <div id="swagger-ui" className="max-w-7xl mx-auto" />
    </div>
  )
}
