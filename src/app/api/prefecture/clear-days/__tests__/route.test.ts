/// <reference types="jest" />

const getDailyWeatherSummariesRangeMock = jest.fn();
const getPrefectureCoordinatesMock = jest.fn();

jest.mock("@/lib/server/open_metro_api_client", () => ({
  getDailyWeatherSummariesRange: (...args: unknown[]) =>
    getDailyWeatherSummariesRangeMock(...args),
}));

jest.mock("@/lib/server/prefecture_geocode", () => ({
  getPrefectureCoordinates: (...args: unknown[]) =>
    getPrefectureCoordinatesMock(...args),
}));

const OUT_OF_RANGE_RESPONSE = {
  startDate: null,
  endDate: null,
  days: [],
  availability: "out_of_supported_range",
  message: "現在の提供期間外のため晴れ予報を表示できません。",
};

describe("GET /api/prefecture/clear-days", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.useFakeTimers();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
  });

  it("today が許容上限を超える場合は 200 + days:[] を返し、外部APIを呼ばない", async () => {
    jest.setSystemTime(new Date("2026-04-04T00:00:00.000Z"));

    process.env.OPEN_METEO_ALLOWED_START_DATE_MIN = "2025-07-10";
    process.env.OPEN_METEO_ALLOWED_START_DATE_MAX = "2025-10-26";

    getPrefectureCoordinatesMock.mockReturnValue({
      latitude: 34.6913,
      longitude: 135.183,
    });

    const { GET } = await import("../route");

    const request = new Request(
      "http://localhost/api/prefecture/clear-days?prefecture=%E5%85%B5%E5%BA%AB%E7%9C%8C",
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ prefecture: "兵庫県", ...OUT_OF_RANGE_RESPONSE });
    expect(getDailyWeatherSummariesRangeMock).not.toHaveBeenCalled();
  });

  it("today が許容上限と同日の場合はウィンドウを計算し外部APIを呼ぶ", async () => {
    jest.setSystemTime(new Date("2025-10-26T00:00:00.000Z"));

    process.env.OPEN_METEO_ALLOWED_START_DATE_MIN = "2025-07-10";
    process.env.OPEN_METEO_ALLOWED_START_DATE_MAX = "2025-10-26";

    getPrefectureCoordinatesMock.mockReturnValue({
      latitude: 34.6913,
      longitude: 135.183,
    });
    getDailyWeatherSummariesRangeMock.mockResolvedValue([
      {
        date: "2025-10-26",
        isClearSky: true,
        weatherCode: 0,
        temperatureMax: 20,
        temperatureMin: 10,
        timezone: "UTC",
      },
    ]);

    const { GET } = await import("../route");

    const request = new Request(
      "http://localhost/api/prefecture/clear-days?prefecture=%E5%85%B5%E5%BA%AB%E7%9C%8C",
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.availability).toBeUndefined();
    expect(payload.startDate).toBe("2025-10-26");
    expect(payload.endDate).toBe("2025-10-26");
    expect(getDailyWeatherSummariesRangeMock).toHaveBeenCalledWith(
      34.6913,
      135.183,
      "2025-10-26",
      "2025-10-26",
    );
  });

  it("today が許容下限より前の場合は minAllowed を start にして外部APIを呼ぶ", async () => {
    jest.setSystemTime(new Date("2025-06-01T00:00:00.000Z"));

    process.env.OPEN_METEO_ALLOWED_START_DATE_MIN = "2025-07-10";
    process.env.OPEN_METEO_ALLOWED_START_DATE_MAX = "2025-10-26";

    getPrefectureCoordinatesMock.mockReturnValue({
      latitude: 34.6913,
      longitude: 135.183,
    });
    getDailyWeatherSummariesRangeMock.mockResolvedValue([
      {
        date: "2025-07-10",
        isClearSky: false,
        weatherCode: 3,
        temperatureMax: 30,
        temperatureMin: 22,
        timezone: "UTC",
      },
    ]);

    const { GET } = await import("../route");

    const request = new Request(
      "http://localhost/api/prefecture/clear-days?prefecture=%E5%85%B5%E5%BA%AB%E7%9C%8C",
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.startDate).toBe("2025-07-10");
    expect(getDailyWeatherSummariesRangeMock).toHaveBeenCalledWith(
      34.6913,
      135.183,
      "2025-07-10",
      expect.any(String),
    );
  });

  it("外部APIが RangeError を投げた場合は 400 ではなく 200 + days:[] を返す", async () => {
    jest.setSystemTime(new Date("2025-08-01T00:00:00.000Z"));

    process.env.OPEN_METEO_ALLOWED_START_DATE_MIN = "2025-07-10";
    process.env.OPEN_METEO_ALLOWED_START_DATE_MAX = "2025-10-26";

    getPrefectureCoordinatesMock.mockReturnValue({
      latitude: 34.6913,
      longitude: 135.183,
    });
    getDailyWeatherSummariesRangeMock.mockRejectedValue(
      new RangeError("date range end must be on or before 2025-10-26"),
    );

    const { GET } = await import("../route");

    const request = new Request(
      "http://localhost/api/prefecture/clear-days?prefecture=%E5%85%B5%E5%BA%AB%E7%9C%8C",
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ prefecture: "兵庫県", ...OUT_OF_RANGE_RESPONSE });
  });

  it("prefecture パラメータが未指定の場合は 400 を返す", async () => {
    const { GET } = await import("../route");

    const request = new Request("http://localhost/api/prefecture/clear-days");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ message: "prefecture is required" });
  });

  it("未対応の prefecture の場合は 400 を返す", async () => {
    getPrefectureCoordinatesMock.mockReturnValue(null);

    const { GET } = await import("../route");

    const request = new Request(
      "http://localhost/api/prefecture/clear-days?prefecture=%E6%9E%B6%E7%A9%BA%E7%9C%8C",
    );
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({ message: "Unsupported prefecture: 架空県" });
  });
});
