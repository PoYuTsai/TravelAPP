import type { PricingExampleDocument } from './sharedExamples'

type MutationResult = { _rev?: string }
type CreatableDocument = Record<string, unknown> & { _type: string; _id?: string }

type PatchBuilder = {
  ifRevisionId: (revision: string) => {
    set: (fields: Record<string, unknown>) => {
      commit: () => Promise<MutationResult>
    }
  }
}

type PricingExampleMutationClient = {
  patch: (documentId: string) => PatchBuilder
  create: (
    document: CreatableDocument,
    options: { returnDocuments: true }
  ) => Promise<MutationResult>
}

export async function savePricingExampleDocument(input: {
  client: PricingExampleMutationClient
  document: PricingExampleDocument
  expectedRevision?: string
  photos: unknown[]
}) {
  if (!input.expectedRevision) {
    return input.client.create(
      { ...input.document, photos: input.photos },
      { returnDocuments: true }
    )
  }

  const { _id, _type, ...fields } = input.document
  return input.client
    .patch(_id)
    .ifRevisionId(input.expectedRevision)
    .set({ ...fields, photos: input.photos })
    .commit()
}
