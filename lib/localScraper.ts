export interface LocalBusinessData {
  name: string;
  address: string;
  city: string;
  phone: string;
  website?: string;
  rating: number;
  reviewCount: number;
  mapsUrl: string;
  niche: string;
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string,
): Promise<{ phone: string; website: string | undefined }> {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_phone_number,website&key=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.status === 'OK' && data.result) {
      return {
        phone: data.result.formatted_phone_number || 'N/A',
        website: data.result.website || undefined,
      }
    }
  } catch {
    // silently fall back
  }
  return { phone: 'N/A', website: undefined }
}

export async function scrapeLocalBusinesses(
  niche: string,
  city: string,
  limit: number = 10
): Promise<LocalBusinessData[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!apiKey) {
    throw new Error('Missing GOOGLE_PLACES_API_KEY environment variable. Get one at https://console.cloud.google.com/apis/credentials')
  }

  console.log(`[Local Scraper] Fetching businesses in "${city}" for niche "${niche}"...`)

  const searchQuery = `${niche} businesses in ${city}`
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      searchQuery
    )}&key=${apiKey}`
  )

  if (!response.ok) {
    throw new Error(`Google Places API error: ${response.statusText}`)
  }

  const data = await response.json()

  if (data.status !== 'OK') {
    if (data.status === 'REQUEST_DENIED') {
      throw new Error('Google Places API key is invalid or billing is not enabled. Enable the Places API and set up billing at https://console.cloud.google.com.')
    }
    throw new Error(`Google Places API returned status: ${data.status} - ${data.error_message || 'No data returned.'}`)
  }

  const rawResults = (data.results || []).slice(0, limit)

  const businesses: LocalBusinessData[] = []

  for (const result of rawResults) {
    const { phone, website } = await fetchPlaceDetails(result.place_id, apiKey)

    if (website) {
      console.log(`[Local Scraper] Skipping ${result.name} — already has website: ${website}`)
      continue
    }

    const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${result.place_id}`
    businesses.push({
      name: result.name || 'Unknown Business',
      address: result.formatted_address || '',
      city,
      phone,
      website: undefined,
      rating: result.rating || 0,
      reviewCount: result.user_ratings_total || 0,
      mapsUrl,
      niche,
    })
  }

  console.log(`[Local Scraper] Found ${businesses.length} businesses without websites in ${city}`)
  return businesses
}
