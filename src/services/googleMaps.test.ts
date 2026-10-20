import { parseAutocomplete, parseDistanceKm, parseGeocode } from "./googleMaps";
import { parseOsrmRoute } from "./routing";

describe("Google web service parsing", () => {
  it("keeps only Ontario predictions", () => {
    const out = parseAutocomplete({
      status: "OK",
      predictions: [
        {
          place_id: "a",
          description: "Fairview Park Mall, Kitchener, ON, Canada",
          structured_formatting: {
            main_text: "Fairview Park Mall",
            secondary_text: "Kitchener, ON, Canada",
          },
        },
        { place_id: "b", description: "Montréal, QC, Canada" },
      ],
    });
    expect(out).toEqual([
      {
        placeId: "a",
        description: "Fairview Park Mall, Kitchener, ON, Canada",
        mainText: "Fairview Park Mall",
        secondaryText: "Kitchener, ON, Canada",
      },
    ]);
  });

  it("rounds the driving distance once, to a tenth of a km", () => {
    expect(
      parseDistanceKm({
        status: "OK",
        rows: [{ elements: [{ status: "OK", distance: { value: 8649 } }] }],
      }),
    ).toBe(8.6);
    expect(
      parseDistanceKm({
        status: "OK",
        rows: [{ elements: [{ status: "ZERO_RESULTS" }] }],
      }),
    ).toBeNull();
  });

  it("reads the first geocoding hit", () => {
    expect(
      parseGeocode({
        status: "OK",
        results: [
          {
            formatted_address: "1 King St, Kitchener, ON N2G 1A1, Canada",
            geometry: { location: { lat: 43.45, lng: -80.49 } },
          },
        ],
      }),
    ).toEqual({
      lat: 43.45,
      lng: -80.49,
      formattedAddress: "1 King St, Kitchener, ON N2G 1A1, Canada",
    });
    expect(parseGeocode({ status: "ZERO_RESULTS", results: [] })).toBeNull();
  });
});

describe("OSRM parsing", () => {
  it("flips GeoJSON lng/lat into lat/lng", () => {
    const r = parseOsrmRoute({
      code: "Ok",
      routes: [
        {
          distance: 8600,
          duration: 720.4,
          geometry: {
            coordinates: [
              [-80.49, 43.45],
              [-80.48, 43.46],
            ],
          },
        },
      ],
    });
    expect(r).toEqual({
      coords: [
        { lat: 43.45, lng: -80.49 },
        { lat: 43.46, lng: -80.48 },
      ],
      distanceKm: 8.6,
      durationSec: 720,
    });
    expect(parseOsrmRoute({ code: "NoRoute", routes: [] })).toBeNull();
  });
});
