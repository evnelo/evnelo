import { describe, expect, it, vi } from "vitest";
import { searchAddresses } from "./geocoding";

describe("address search", () => {
  it("normalizes Photon results for the event form", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ features: [{
      geometry: { coordinates: [-46.6606, -23.5578] },
      properties: { name: "Casa Cultural", street: "Rua Augusta", housenumber: "1500", city: "São Paulo", countrycode: "BR", country: "Brazil" },
    }] }), { status: 200 }));

    await expect(searchAddresses("Rua Augusta 1500", fetcher)).resolves.toEqual([{
      label: "Casa Cultural, Rua Augusta 1500, São Paulo, Brazil",
      address: "Rua Augusta 1500",
      city: "São Paulo",
      country: "BR",
      lat: "-23.5578",
      lng: "-46.6606",
    }]);
  });

  it("does not call the provider for short queries", async () => {
    const fetcher = vi.fn();
    await expect(searchAddresses("ab", fetcher)).resolves.toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("caches repeated provider queries", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ features: [] }), { status: 200 }));
    await searchAddresses("unique cache query", fetcher);
    await searchAddresses("unique cache query", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
