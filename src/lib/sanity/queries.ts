// src/lib/sanity/queries.ts
import { projectId, dataset, apiVersion } from '@/sanity/config'

export async function getItineraryById(id: string) {
  const query = `*[_type == "itinerary" && _id == $id][0]{
    _id,
    _updatedAt,
    clientName,
    startDate,
    endDate,
    adults,
    children,
    childrenAges,
    days[]{
      date,
      title,
      morning,
      afternoon,
      evening,
      activities[]{
        time,
        content
      },
      lunch,
      dinner,
      accommodation,
      carPrice,
      guidePrice
    },
    hotels[]{
      hotelName,
      startDate,
      endDate,
      guests,
      note,
      color
    },
    totalPrice,
    priceIncludes,
    priceExcludes
  }`

  // 使用 apicdn=false 強制繞過 Sanity CDN 快取
  // 安全：使用 encodeURIComponent 防止 query injection
  const url = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(query)}&$id=${encodeURIComponent(JSON.stringify(id))}`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    next: { revalidate: 0 },
  })

  const data = await response.json()
  return data.result
}
