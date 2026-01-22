import type { StructureResolver } from 'sanity/structure'

// Singleton document types - these should only have one document
const singletonTypes = new Set(['landingPage', 'carCharter', 'homestay'])

export const structure: StructureResolver = (S) =>
  S.list()
    .id('root')
    .title('內容管理')
    .items([
      // 頁面設定區塊
      S.listItem()
        .id('pages')
        .title('頁面設定')
        .child(
          S.list()
            .id('pages-list')
            .title('頁面設定')
            .items([
              // 首頁
              S.listItem()
                .id('landingPage')
                .title('首頁設定')
                .child(
                  S.document()
                    .schemaType('landingPage')
                    .documentId('landingPage')
                ),
              // 包車服務
              S.listItem()
                .id('carCharter')
                .title('包車服務頁面')
                .child(
                  S.document()
                    .schemaType('carCharter')
                    .documentId('carCharter')
                ),
              // 民宿
              S.listItem()
                .id('homestay')
                .title('民宿頁面')
                .child(
                  S.document()
                    .schemaType('homestay')
                    .documentId('homestay')
                ),
            ])
        ),

      S.divider(),

      // 客戶行程表（新增）
      S.documentTypeListItem('itinerary').title('客戶行程表'),

      S.divider(),

      // 部落格文章
      S.documentTypeListItem('post').title('部落格文章'),

      S.divider(),

      // 招牌套餐
      S.documentTypeListItem('tourPackage').title('招牌套餐'),
    ])
