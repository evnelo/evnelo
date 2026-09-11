export type AddressSuggestion = {
  label: string;
  address: string;
  city: string;
  country: string;
  lat: string;
  lng: string;
};

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const cache = new Map<string, { expiresAt: number; data: AddressSuggestion[] }>();

export type GeocoderConfig = { provider: "photon" | "mapbox" | "none"; photonUrl?: string; mapboxToken?: string };

export async function searchAddresses(query: string, fetcher: Fetcher = fetch, config: GeocoderConfig): Promise<AddressSuggestion[]> {
  const term = query.trim().slice(0, 160);
  if (term.length < 3 || config.provider === "none") return [];
  if (config.provider === "mapbox" && !config.mapboxToken) return [];
  const cacheKey = `${config.provider}:${term.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const data = config.provider === "mapbox" ? await searchMapbox(term, config.mapboxToken!, fetcher) : await searchPhoton(term, fetcher, config.photonUrl ?? "https://photon.komoot.io");
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, data });
  return data;
}

async function searchPhoton(term: string, fetcher: Fetcher, base: string): Promise<AddressSuggestion[]> {
  const url = new URL("/api/", base);
  url.searchParams.set("q", term);
  url.searchParams.set("limit", "5");
  const response = await fetcher(url, { headers: { Accept: "application/json", "User-Agent": "Evnelo/1.0 (https://evnelo.com)" }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Address search is temporarily unavailable.");
  const payload = await response.json() as { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: Record<string, string> }> };
  return (payload.features ?? []).flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates;
    const p = feature.properties ?? {};
    if (!coordinates || coordinates.length < 2) return [];
    const address = [p.street, p.housenumber].filter(Boolean).join(" ") || p.name || "";
    const label = Array.from(new Set([p.name, address, p.city, p.country].filter(Boolean))).join(", ");
    if (!label) return [];
    return [{
      label,
      address,
      city: p.city ?? "",
      country: (p.countrycode ?? "").toUpperCase(),
      lat: String(coordinates[1]),
      lng: String(coordinates[0]),
    }];
  });
}

async function searchMapbox(term: string, token: string, fetcher: Fetcher): Promise<AddressSuggestion[]> {
  const url = new URL(`https://api.mapbox.com/search/geocode/v6/forward`);
  url.searchParams.set("q", term);
  url.searchParams.set("limit", "5");
  url.searchParams.set("access_token", token);
  const response = await fetcher(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error("Address search is temporarily unavailable.");
  const payload = await response.json() as { features?: Array<{ geometry?: { coordinates?: [number, number] }; properties?: { full_address?: string; name?: string; context?: { place?: { name?: string }; country?: { country_code?: string } } } }> };
  return (payload.features ?? []).flatMap((feature) => {
    const coordinates = feature.geometry?.coordinates;
    const p = feature.properties;
    if (!coordinates || !p) return [];
    const label = p.full_address ?? p.name ?? "";
    if (!label) return [];
    return [{
      label,
      address: p.name ?? label,
      city: p.context?.place?.name ?? "",
      country: (p.context?.country?.country_code ?? "").toUpperCase(),
      lat: String(coordinates[1]),
      lng: String(coordinates[0]),
    }];
  });
}
