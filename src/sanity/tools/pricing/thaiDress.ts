type ThaiDressPhotographerOptions = {
  isSelected: boolean
  people: number
  includeExtraPhotographer: boolean
}

export function shouldOfferExtraPhotographer(people: number) {
  return people > 10
}

export function getThaiDressPhotographerCount({
  isSelected,
  people,
  includeExtraPhotographer,
}: ThaiDressPhotographerOptions) {
  if (!isSelected) return 0

  return 1 + (shouldOfferExtraPhotographer(people) && includeExtraPhotographer ? 1 : 0)
}

export function getThaiDressPhotographerLabel(count: number) {
  if (count <= 1) {
    return '攝影師 1 小時（1位，最多服務 10 位）'
  }

  return `攝影師 1 小時（${count}位，每位最多服務 10 位）`
}
