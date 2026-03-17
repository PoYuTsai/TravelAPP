import type { StructureResolver } from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .id('root')
    .title('Content / 內容管理')
    .items([
      S.listItem()
        .id('siteSettings')
        .title('Site Settings / 全站設定')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),

      S.divider(),

      S.listItem()
        .id('pages')
        .title('Pages / 頁面設定')
        .child(
          S.list()
            .id('pages-list')
            .title('Pages / 頁面設定')
            .items([
              S.listItem()
                .id('landingPage')
                .title('Landing Page / 首頁設定')
                .child(S.document().schemaType('landingPage').documentId('landingPage')),
              S.listItem()
                .id('carCharter')
                .title('Car Charter / 包車服務頁')
                .child(S.document().schemaType('carCharter').documentId('carCharter')),
              S.listItem()
                .id('homestay')
                .title('Homestay / 民宿頁')
                .child(S.document().schemaType('homestay').documentId('homestay')),
            ])
        ),

      S.divider(),

      S.documentTypeListItem('itinerary').title('Itineraries / 客戶行程'),

      S.divider(),

      S.documentTypeListItem('post').title('Blog Posts / 文章'),

      S.divider(),

      S.documentTypeListItem('tourPackage').title('Tour Packages / 多日套裝'),
      S.documentTypeListItem('dayTour').title('Day Tours / 一日包車'),
    ])
