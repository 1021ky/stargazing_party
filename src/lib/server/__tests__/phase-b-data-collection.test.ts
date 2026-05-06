/**
 * Phase B Integration Test: GIBS Light Pollution Data Collection
 *
 * This test collects light pollution data from 3 fixed locations:
 * 1. Umeda Station (Osaka) - Urban area, expected to be BRIGHT
 * 2. Namba Station (Osaka) - Urban area, expected to be BRIGHT
 * 3. Tenkawa Village (Nara) - Mountain area, expected to be DARK
 */

import { deflateSync } from "node:zlib";
import { resolveLightPollution } from "../light_pollution_service";

interface TestLocation {
  name: string;
  latitude: number;
  longitude: number;
}

const testLocations: TestLocation[] = [
  {
    name: "Umeda Station (Osaka)",
    latitude: 34.702,
    longitude: 135.4955,
  },
  {
    name: "Namba Station (Osaka)",
    latitude: 34.6653,
    longitude: 135.5023,
  },
  {
    name: "Tenkawa Village (Nara)",
    latitude: 34.1833,
    longitude: 136.0333,
  },
];

function buildSolidPng(brightness: number): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(3, 0);
  ihdrData.writeUInt32BE(3, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(2, 9);
  const ihdrChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),
    Buffer.from("IHDR"),
    ihdrData,
    Buffer.alloc(4),
  ]);

  const scanlines = Buffer.alloc(3 * (1 + 3 * 3));
  for (let row = 0; row < 3; row += 1) {
    const rowOffset = row * 10;
    scanlines.writeUInt8(0, rowOffset);
    for (let column = 0; column < 3; column += 1) {
      const pixelOffset = rowOffset + 1 + column * 3;
      scanlines.writeUInt8(brightness, pixelOffset);
      scanlines.writeUInt8(brightness, pixelOffset + 1);
      scanlines.writeUInt8(brightness, pixelOffset + 2);
    }
  }

  const compressed = deflateSync(scanlines);
  const idatLength = Buffer.alloc(4);
  idatLength.writeUInt32BE(compressed.length, 0);
  const idatChunk = Buffer.concat([
    idatLength,
    Buffer.from("IDAT"),
    compressed,
    Buffer.alloc(4),
  ]);

  const iendChunk = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from("IEND"),
    Buffer.alloc(4),
  ]);

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function resolveMockBrightness(latitude: number, longitude: number): number {
  if (
    latitude > 34.6 &&
    latitude < 34.8 &&
    longitude > 135.4 &&
    longitude < 135.6
  ) {
    return 180;
  }

  if (
    latitude > 34.1 &&
    latitude < 34.2 &&
    longitude > 136.0 &&
    longitude < 136.1
  ) {
    return 20;
  }

  return 80;
}

describe("GIBS light pollution data collection", () => {
  beforeEach(() => {
    jest.spyOn(global, "fetch").mockImplementation((input: string | URL) => {
      const url = new URL(input.toString());
      const bbox = url.searchParams.get("BBOX");
      if (!bbox) {
        return Promise.reject(new Error("Missing BBOX"));
      }

      const [minLongitude, minLatitude, maxLongitude, maxLatitude] = bbox
        .split(",")
        .map((value) => Number.parseFloat(value));
      const latitude = (minLatitude + maxLatitude) / 2;
      const longitude = (minLongitude + maxLongitude) / 2;
      const brightness = resolveMockBrightness(latitude, longitude);

      return Promise.resolve(
        new Response(buildSolidPng(brightness), {
          status: 200,
          headers: { "Content-Type": "image/png" },
        }),
      );
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should collect light pollution data from all 3 locations", async () => {
    const results = [];

    for (const location of testLocations) {
      const result = await resolveLightPollution({
        latitude: location.latitude,
        longitude: location.longitude,
        year: 2025,
      });

      results.push({
        location: location.name,
        ...result,
      });
    }

    expect(results).toHaveLength(3);
    expect(
      results.every(
        (result) => result.lightPollutionSource === "gibs-black-marble",
      ),
    ).toBe(true);
    expect(results.map((result) => result.lightPollutionDataLabel)).toEqual([
      "2016年データ",
      "2016年データ",
      "2016年データ",
    ]);
    expect(results[0].lightPollutionLevel).toBe("高");
    expect(results[1].lightPollutionLevel).toBe("高");
    expect(results[2].lightPollutionLevel).toBe("低");
    expect(results[0].lightPollutionProxy ?? 0).toBeGreaterThan(
      results[2].lightPollutionProxy ?? 0,
    );
  });
});
