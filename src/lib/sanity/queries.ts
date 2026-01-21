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
  const url = `https://${projectId}.api.sanity.io/v${apiVersion}/data/query/${dataset}?query=${encodeURIComponent(query)}&$id="${id}"`

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    next: { revalidate: 0 },
  })

  const data = await response.json()

  // Debug: 顯示完整資料
  console.log('=== Sanity Query Debug ===')
  console.log('Query ID:', id)
  console.log('Updated at:', data.result?._updatedAt)
  console.log('Client:', data.result?.clientName)
  console.log('Start Date:', data.result?.startDate)
  console.log('End Date:', data.result?.endDate)
  console.log('Days:', JSON.stringify(data.result?.days?.map((d: any) => ({ date: d.date, title: d.title })), null, 2))
  console.log('Hotels:', JSON.stringify(data.result?.hotels, null, 2))

  return data.result
}
