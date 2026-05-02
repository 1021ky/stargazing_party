import type { FeatureCollection } from "geojson";
import { loadPrefectureGeoJSON } from "../map_data_provider";

describe("loadPrefectureGeoJSON", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it("静的 GeoJSON を読み込み、FeatureCollection を返す", async () => {
    const featureCollection: FeatureCollection = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { prefecture: "長野県" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [138, 36],
                [138.5, 36],
                [138.5, 36.5],
                [138, 36.5],
                [138, 36],
              ],
            ],
          },
        },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => featureCollection,
    } as Response);

    await expect(loadPrefectureGeoJSON()).resolves.toEqual(featureCollection);
    expect(global.fetch).toHaveBeenCalledWith("/geo/prefectures.geojson");
  });

  it("読み込みに失敗した場合はユーザー向けエラーを投げる", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    await expect(loadPrefectureGeoJSON()).rejects.toThrow(
      "地図データの読み込みに失敗しました",
    );
  });
});
