type InsuranceCostOptions = {
  includeInsurance: boolean
  people: number
  insurancePerPerson: number
}

type SavedInsuranceSelectionOptions = {
  savedIncludeInsurance?: boolean
  includeAccommodation: boolean
  includeMeals: boolean
  hasSelectedTickets: boolean
}

export function getInsuranceCost({
  includeInsurance,
  people,
  insurancePerPerson,
}: InsuranceCostOptions) {
  return includeInsurance ? people * insurancePerPerson : 0
}

export function resolveSavedInsuranceSelection({
  savedIncludeInsurance,
  includeAccommodation,
  includeMeals,
  hasSelectedTickets,
}: SavedInsuranceSelectionOptions) {
  if (typeof savedIncludeInsurance === 'boolean') {
    return savedIncludeInsurance
  }

  return includeAccommodation || includeMeals || hasSelectedTickets
}
