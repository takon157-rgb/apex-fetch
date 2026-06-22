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

/**
 * Scrapes local businesses from the Google Places Text Search API.
 * This implementation requires a valid API key and does not provide mock fallback data.
 */
export async function scrapeLocalBusinesses(
  niche: string,
  city: string,
  limit: number = 10
): Promise<LocalBusinessData[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    throw new Error('Missing GOOGLE_PLACES_API_KEY environment variable. Local scraping requires a valid Google Places API key.');
  }

  console.log(`[Local Scraper] Fetching businesses in "${city}" for niche "${niche}"...`);

  const searchQuery = `${niche} businesses in ${city}`;
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(
      searchQuery
    )}&key=${apiKey}`
  );

  if (!response.ok) {
    throw new Error(`Google Places API error: ${response.statusText}`);
  }

  const data = await response.json();

  if (data.status !== 'OK') {
    throw new Error(`Google Places API returned status: ${data.status} - ${data.error_message || 'No data returned.'}`);
  }

  const businesses: LocalBusinessData[] = (data.results || [])
    .filter((result: any) => !result.website || result.website.trim() === '')
    .slice(0, limit)
    .map((result: any) => {
      const mapsUrl = `https://www.google.com/maps/place/?q=place_id:${result.place_id}`;
      return {
        name: result.name || 'Unknown Business',
        address: result.formatted_address || '',
        city,
        phone: result.formatted_phone_number || 'N/A',
        website: result.website || undefined,
        rating: result.rating || 0,
        reviewCount: result.user_ratings_total || 0,
        mapsUrl,
        niche,
      };
    });

  console.log(`[Local Scraper] Found ${businesses.length} businesses without websites in ${city}`);
  return businesses;
}

/**
 * Validates that a business has no website.
 */
export function hasNoWebsite(business: LocalBusinessData): boolean {
  return !business.website || business.website.trim() === '';
}
