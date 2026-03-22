import type { StructureResolver } from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .id('root')
    .title('Content')
    .items([
      S.listItem()
        .id('siteSettings')
        .title('Site Settings')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),

      S.divider(),

      S.listItem()
        .id('pages')
        .title('Pages')
        .child(
          S.list()
            .id('pages-list')
            .title('Pages')
            .items([
              S.listItem()
                .id('landingPage')
                .title('Landing Page')
                .child(S.document().schemaType('landingPage').documentId('landingPage')),
              S.listItem()
                .id('carCharter')
                .title('Car Charter')
                .child(S.document().schemaType('carCharter').documentId('carCharter')),
              S.listItem()
                .id('homestay')
                .title('Homestay')
                .child(S.document().schemaType('homestay').documentId('homestay')),
            ])
        ),

      S.divider(),

      S.listItem()
        .id('lineAssistant')
        .title('LINE Assistant / AI Ops')
        .child(
          S.list()
            .id('line-assistant-list')
            .title('LINE Assistant / AI Ops')
            .items([
              S.documentTypeListItem('learningConversation').title('Learning Conversations'),
              S.documentTypeListItem('promptVersion').title('Prompt Versions'),
              S.documentTypeListItem('itineraryTemplate').title('Itinerary Templates'),
            ])
        ),

      S.divider(),

      S.documentTypeListItem('itinerary').title('Itineraries'),

      S.divider(),

      S.documentTypeListItem('post').title('Blog Posts'),

      S.divider(),

      S.documentTypeListItem('tourPackage').title('Tour Packages'),
      S.documentTypeListItem('dayTour').title('Day Tours'),
    ])
