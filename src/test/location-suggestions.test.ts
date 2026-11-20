import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLocationSuggestions } from "@/lib/location-suggestions";

describe("fetchLocationSuggestions", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("falls back to geocoding suggestions when Google Places returns no options", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([
            {
              place_id: 1,
              display_name: "Pune, Maharashtra, India",
              lat: "18.5204",
              lon: "73.8567",
              type: "city",
            },
          ]),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const results = await fetchLocationSuggestions("Pune", new AbortController().signal);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      display_name: "Pune, Maharashtra, India",
      lat: "18.5204",
      lon: "73.8567",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/geocode?q=Pune&limit=6",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("normalizes the deployed single-result geocode response instead of dropping it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            place_id: "google-place-id",
            formatted_address: "Pune, Maharashtra, India",
            lat: 18.5204,
            lng: 73.8567,
            state: "Maharashtra",
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const results = await fetchLocationSuggestions("Pune", new AbortController().signal);

    expect(results).toEqual([
      {
        place_id: "google-place-id",
        display_name: "Pune, Maharashtra, India",
        lat: "18.5204",
        lon: "73.8567",
        type: "place",
        address: { state: "Maharashtra" },
      },
    ]);
  });
});
