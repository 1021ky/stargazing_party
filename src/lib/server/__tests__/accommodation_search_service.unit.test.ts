import { searchStargazingAccommodations } from "../accommodation_search_service";

jest.mock("../prefecture_geocode", () => ({
  getPrefectureCoordinates: jest.fn(),
}));

jest.mock("../yahoo_reverse_geocoder_api_client", () => ({
  getYahooReverseGeocodedAddress: jest.fn(),
}));

jest.mock("../open_metro_api_client", () => ({
  getDailyWeatherSummary: jest.fn(),
}));

jest.mock("../rakuten_travel_hotel_search_api_client", () => ({
  searchHotelsWithAvailability: jest.fn(),
}));

jest.mock("../light_pollution_service", () => ({
  resolveLightPollution: jest.fn(),
}));

describe("searchStargazingAccommodations", () => {
  const { getPrefectureCoordinates } = jest.requireMock(
    "../prefecture_geocode",
  );
  const { getYahooReverseGeocodedAddress } = jest.requireMock(
    "../yahoo_reverse_geocoder_api_client",
  );
  const { getDailyWeatherSummary } = jest.requireMock(
    "../open_metro_api_client",
  );
  const { searchHotelsWithAvailability } = jest.requireMock(
    "../rakuten_travel_hotel_search_api_client",
  );
  const { resolveLightPollution } = jest.requireMock(
    "../light_pollution_service",
  );

  beforeEach(() => {
    jest.resetAllMocks();
    getPrefectureCoordinates.mockReturnValue({
      latitude: 35.68944,
      longitude: 139.69167,
    });
    getYahooReverseGeocodedAddress.mockResolvedValue("東京都千代田区千代田1-1");
    getDailyWeatherSummary.mockResolvedValue({
      date: "2025-02-01",
      isClearSky: true,
      weatherCode: 0,
      temperatureMax: 10,
      temperatureMin: 2,
      timezone: "Asia/Tokyo",
    });
    searchHotelsWithAvailability.mockResolvedValue([
      {
        id: "1",
        name: "ホテルA",
        location: "千代田区",
        prefecture: "東京都",
        newMoonDate: "2025年2月1日",
        clearSkyProbability: 85,
        price: 18000,
        rating: 4.5,
        availableRooms: 2,
        imageUrl: "https://example.com/a.jpg",
        lightPollution: "低",
        altitude: 50,
        bookingUrl: "https://example.com/a",
        latitude: 35.69,
        longitude: 139.75,
      },
      {
        id: "2",
        name: "ホテルB",
        location: "中央区",
        prefecture: "東京都",
        newMoonDate: "2025年2月1日",
        clearSkyProbability: 60,
        price: 15000,
        rating: 4.2,
        availableRooms: 0,
        imageUrl: "https://example.com/b.jpg",
        lightPollution: "中",
        altitude: 40,
        bookingUrl: "https://example.com/b",
        latitude: 35.67,
        longitude: 139.77,
      },
    ]);
    resolveLightPollution.mockResolvedValue({
      lightPollutionProxy: 35,
      lightPollutionLevel: "低",
      lightPollutionSource: "black-marble-vnp46a4",
      lightPollutionDataLabel: "2024年データ",
    });
  });

  it("天気が晴れの場合に、空き室があるホテルを返す", async () => {
    const result = await searchStargazingAccommodations({
      date: "2025-02-01",
      prefecture: "東京都",
    });

    expect(result.accommodations).toHaveLength(1);
    expect(result.accommodations[0]).toMatchObject({
      id: "1",
      name: "ホテルA",
      lightPollutionLevel: "低",
    });
    expect(result.resolvedAddress).toBe("東京都千代田区千代田1-1");
    expect(getPrefectureCoordinates).toHaveBeenCalledWith("東京都");
    expect(getYahooReverseGeocodedAddress).toHaveBeenCalledWith(
      35.68944,
      139.69167,
    );
    expect(getDailyWeatherSummary).toHaveBeenCalledWith(
      35.68944,
      139.69167,
      "2025-02-01",
    );
    expect(searchHotelsWithAvailability).toHaveBeenCalledWith(
      35.68944,
      139.69167,
      ["2025-02-01"],
    );
    expect(resolveLightPollution).toHaveBeenCalledWith({
      latitude: 35.69,
      longitude: 139.75,
    });
  });

  it("天気が晴れでない場合もホテル候補を返す", async () => {
    getDailyWeatherSummary.mockResolvedValueOnce({
      date: "2025-02-01",
      isClearSky: false,
      weatherCode: 3,
      temperatureMax: 8,
      temperatureMin: 1,
      timezone: "Asia/Tokyo",
    });

    const result = await searchStargazingAccommodations({
      date: "2025-02-01",
      prefecture: "東京都",
    });

    expect(result.accommodations).toHaveLength(1);
    expect(result.weather).toMatchObject({
      isClearSky: false,
      weatherCode: 3,
    });
    expect(searchHotelsWithAvailability).toHaveBeenCalledWith(
      35.68944,
      139.69167,
      ["2025-02-01"],
    );
  });

  it("宿泊 API が失敗しても空配列で結果を返す", async () => {
    searchHotelsWithAvailability.mockRejectedValueOnce(
      new Error("Unexpected status code: 429"),
    );

    const result = await searchStargazingAccommodations({
      date: "2025-02-01",
      prefecture: "東京都",
    });

    expect(result.accommodations).toHaveLength(0);
    expect(result.resolvedAddress).toBe("東京都千代田区千代田1-1");
    expect(result.weather).toMatchObject({
      date: "2025-02-01",
      isClearSky: true,
      weatherCode: 0,
    });
  });

  it("都道府県がサポート対象外の場合は例外を投げる", async () => {
    getPrefectureCoordinates.mockReturnValueOnce(null);

    await expect(
      searchStargazingAccommodations({
        date: "2025-02-01",
        prefecture: "架空県",
      }),
    ).rejects.toThrow("Unsupported prefecture: 架空県");
  });

  it("日付が不正な場合は例外を投げる", async () => {
    await expect(
      searchStargazingAccommodations({
        date: "invalid-date",
        prefecture: "東京都",
      }),
    ).rejects.toThrow("date must be a valid ISO 8601 string (YYYY-MM-DD)");
  });

  it("bounds 指定時は中心座標を使って検索する", async () => {
    const result = await searchStargazingAccommodations({
      date: "2025-02-01",
      bounds: {
        minLatitude: 35.6,
        maxLatitude: 35.8,
        minLongitude: 139.6,
        maxLongitude: 139.8,
      },
    });

    expect(result.latitude).toBe(35.7);
    expect(result.longitude).toBe(139.7);
    expect(getPrefectureCoordinates).not.toHaveBeenCalled();
    expect(getYahooReverseGeocodedAddress).toHaveBeenCalledWith(35.7, 139.7);
    expect(getDailyWeatherSummary).toHaveBeenCalledWith(
      35.7,
      139.7,
      "2025-02-01",
    );
    expect(searchHotelsWithAvailability).toHaveBeenCalledWith(35.7, 139.7, [
      "2025-02-01",
    ]);
  });

  it("filters が指定された場合は価格上限と評価下限で厳密フィルタする", async () => {
    searchHotelsWithAvailability.mockResolvedValueOnce([
      {
        id: "1",
        name: "ホテルA",
        location: "千代田区",
        prefecture: "東京都",
        newMoonDate: "2025年2月1日",
        clearSkyProbability: 85,
        price: 18000,
        rating: 4.5,
        availableRooms: 2,
        imageUrl: "https://example.com/a.jpg",
        lightPollution: "低",
        altitude: 50,
        bookingUrl: "https://example.com/a",
        latitude: 35.69,
        longitude: 139.75,
      },
      {
        id: "2",
        name: "ホテルB",
        location: "中央区",
        prefecture: "東京都",
        newMoonDate: "2025年2月1日",
        clearSkyProbability: 82,
        price: 21000,
        rating: 4.6,
        availableRooms: 2,
        imageUrl: "https://example.com/b.jpg",
        lightPollution: "低",
        altitude: 45,
        bookingUrl: "https://example.com/b",
        latitude: 35.67,
        longitude: 139.77,
      },
      {
        id: "3",
        name: "ホテルC",
        location: "港区",
        prefecture: "東京都",
        newMoonDate: "2025年2月1日",
        clearSkyProbability: 81,
        price: 17000,
        rating: 3.8,
        availableRooms: 2,
        imageUrl: "https://example.com/c.jpg",
        lightPollution: "中",
        altitude: 30,
        bookingUrl: "https://example.com/c",
        latitude: 35.66,
        longitude: 139.74,
      },
    ]);

    const result = await searchStargazingAccommodations({
      date: "2025-02-01",
      prefecture: "東京都",
      filters: {
        maxPrice: 20000,
        minRating: 4.0,
      },
    });

    expect(result.accommodations).toHaveLength(1);
    expect(result.accommodations[0]).toMatchObject({
      id: "1",
      name: "ホテルA",
    });
  });

  it("光害情報取得が失敗しても検索結果を返す", async () => {
    resolveLightPollution.mockResolvedValueOnce({
      lightPollutionProxy: null,
      lightPollutionLevel: "不明",
      lightPollutionSource: "fallback",
      lightPollutionDataLabel: "2024年データ",
    });

    const result = await searchStargazingAccommodations({
      date: "2025-02-01",
      prefecture: "東京都",
    });

    expect(result.accommodations).toHaveLength(1);
    expect(result.accommodations[0]).toMatchObject({
      lightPollutionLevel: "不明",
      lightPollutionSource: "fallback",
      lightPollutionProxy: null,
    });
  });
});
