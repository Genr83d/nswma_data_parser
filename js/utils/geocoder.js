const NOMINATIM_CACHE_KEY = "wcis:nominatim-cache:v1";
const NOMINATIM_LAST_REQUEST_KEY = "wcis:nominatim-last-request";
const NOMINATIM_MIN_INTERVAL_MS = 1000;

export function buildGeocodeQuery(district) {
  return `${district.district}, ${district.community}, ${district.parish === "Unknown" ? "" : district.parish}, Jamaica`
    .replace(/\s+/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();
}

export async function searchNominatim(query) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];
  const cache = readCache();
  if (cache[normalizedQuery]) return cache[normalizedQuery];

  await waitForRateLimit();
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=jm&q=${encodeURIComponent(normalizedQuery)}`;
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Nominatim search failed (${response.status})`);

  const results = (await response.json())
    .map((item) => ({
      displayName: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
      type: item.type || "",
      category: item.category || "",
      importance: Number(item.importance || 0)
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

  cache[normalizedQuery] = results;
  writeCache(cache);
  return results;
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(NOMINATIM_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeCache(cache) {
  localStorage.setItem(NOMINATIM_CACHE_KEY, JSON.stringify(cache));
}

async function waitForRateLimit() {
  const lastRequest = Number(localStorage.getItem(NOMINATIM_LAST_REQUEST_KEY) || 0);
  const elapsed = Date.now() - lastRequest;
  if (elapsed < NOMINATIM_MIN_INTERVAL_MS) {
    await new Promise((resolve) => setTimeout(resolve, NOMINATIM_MIN_INTERVAL_MS - elapsed));
  }
  localStorage.setItem(NOMINATIM_LAST_REQUEST_KEY, String(Date.now()));
}
