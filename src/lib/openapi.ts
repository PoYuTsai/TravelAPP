/**
 * OpenAPI 3.0 Specification for Chiangway Travel API
 */

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Chiangway Travel API',
    description: '清微旅行內部 API，用於行程匯出和管理儀表板。',
    version: '1.0.0',
    contact: {
      name: 'Chiangway Travel',
      url: 'https://chiangway-travel.com',
    },
  },
  servers: [
    {
      url: 'https://chiangway-travel.com',
      description: 'Production',
    },
    {
      url: 'http://localhost:3000',
      description: 'Development',
    },
  ],
  tags: [
    {
      name: 'Itinerary',
      description: '行程匯出相關 API',
    },
    {
      name: 'Dashboard',
      description: '管理儀表板 API',
    },
    {
      name: 'Tours',
      description: '旅遊行程案例 API',
    },
  ],
  paths: {
    '/api/itinerary/{id}/text': {
      get: {
        tags: ['Itinerary'],
        summary: '匯出行程為 LINE 文字格式',
        description: '將指定行程匯出為適合 LINE 記事本的純文字 HTML 頁面，方便複製貼上。',
        operationId: 'getItineraryText',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Sanity 行程文件 ID',
          },
        ],
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description: '成功回傳 HTML 頁面',
            content: {
              'text/html': {
                schema: { type: 'string' },
              },
            },
          },
          '401': {
            description: '未授權 - 缺少或無效的 API Key',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '404': {
            description: '找不到行程',
          },
          '429': {
            description: '請求過於頻繁',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/itinerary/{id}/pdf': {
      get: {
        tags: ['Itinerary'],
        summary: '匯出行程為 PDF',
        description: '將指定行程匯出為 PDF 檔案，使用 Puppeteer 生成。資源密集，有較嚴格的速率限制。',
        operationId: 'getItineraryPdf',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Sanity 行程文件 ID',
          },
        ],
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description: '成功回傳 PDF 檔案',
            content: {
              'application/pdf': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          '401': {
            description: '未授權',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '404': {
            description: '找不到行程',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '429': {
            description: '請求過於頻繁 (10 req/min)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '500': {
            description: 'PDF 生成失敗',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/itinerary/{id}/excel': {
      get: {
        tags: ['Itinerary'],
        summary: '匯出行程為 Excel',
        description: '將指定行程匯出為 Excel (.xlsx) 檔案。',
        operationId: 'getItineraryExcel',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
            description: 'Sanity 行程文件 ID',
          },
        ],
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description: '成功回傳 Excel 檔案',
            content: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
          },
          '401': {
            description: '未授權',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '404': {
            description: '找不到行程',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '429': {
            description: '請求過於頻繁 (20 req/min)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/dashboard': {
      get: {
        tags: ['Dashboard'],
        summary: '取得儀表板資料',
        description: '取得 Notion 資料庫的儀表板資料，支援年月篩選。需要 email 白名單驗證。',
        operationId: 'getDashboard',
        parameters: [
          {
            name: 'year',
            in: 'query',
            schema: { type: 'integer' },
            description: '篩選年份 (e.g., 2026)',
          },
          {
            name: 'month',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 12 },
            description: '篩選月份 (1-12)',
          },
        ],
        security: [{ EmailAuth: [] }],
        responses: {
          '200': {
            description: '成功回傳儀表板資料',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DashboardData' },
              },
            },
          },
          '401': {
            description: '未授權 - Email 不在白名單中',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
          '429': {
            description: '請求過於頻繁 (60 req/min)',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' },
              },
            },
          },
        },
      },
    },
    '/api/tours/cases': {
      get: {
        tags: ['Tours'],
        summary: '取得旅遊案例列表',
        description: '取得所有公開的旅遊案例，用於網站展示。',
        operationId: 'getTourCases',
        responses: {
          '200': {
            description: '成功回傳案例列表',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/TourCase' },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: '內部 API Key，需要在 .env 中設定 INTERNAL_API_KEY',
      },
      EmailAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-User-Email',
        description: 'Email 白名單驗證，需要在 DASHBOARD_ALLOWED_EMAILS 中',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: '錯誤訊息',
          },
          message: {
            type: 'string',
            description: '詳細錯誤說明（可選）',
          },
        },
        required: ['error'],
      },
      DashboardData: {
        type: 'object',
        description: '儀表板資料結構（由 Notion 資料庫決定）',
        additionalProperties: true,
      },
      TourCase: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          title: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          image: { type: 'object' },
        },
      },
    },
  },
}
