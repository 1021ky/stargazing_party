import { resolveLightPollution } from "../light_pollution_service";

jest.mock("../black_marble_api_client", () => ({
  getBlackMarbleProxy: jest.fn(),
}));

jest.mock("../gibs_light_pollution_client", () => ({
  fetchGibsPixelBrightness: jest.fn(),
  resolveGibsWmsTime: jest.fn().mockReturnValue("2024-01-01"),
  GIBS_BRIGHTNESS_LOW_THRESHOLD: 30,
  GIBS_BRIGHTNESS_HIGH_THRESHOLD: 80,
}));

describe("resolveLightPollution", () => {
  const { getBlackMarbleProxy } = jest.requireMock(
    "../black_marble_api_client",
  );
  const { fetchGibsPixelBrightness, resolveGibsWmsTime } = jest.requireMock(
    "../gibs_light_pollution_client",
  );

  beforeEach(() => {
    jest.resetAllMocks();
    resolveGibsWmsTime.mockReturnValue("2024-01-01");
  });

  it.each([
    { proxyRaw: 39, level: "低" },
    { proxyRaw: 40, level: "中" },
    { proxyRaw: 119, level: "中" },
    { proxyRaw: 120, level: "高" },
  ])(
    "proxyRaw=$proxyRaw の境界値で level=$level を返す",
    async ({ proxyRaw, level }) => {
      getBlackMarbleProxy.mockResolvedValue({
        proxyRaw,
        qualityFlag: 0,
        isNoData: false,
      });

      const result = await resolveLightPollution({
        latitude: 35.68,
        longitude: 139.76,
        year: 2024,
      });

      expect(result.lightPollutionLevel).toBe(level);
      expect(result.lightPollutionSource).toBe("black-marble-vnp46a4");
      expect(result.lightPollutionProxy).toBe(proxyRaw);
      expect(result.lightPollutionDataLabel).toBe("2024年データ");
    },
  );

  it("quality=2 の場合は gap-filled source を返す", async () => {
    getBlackMarbleProxy.mockResolvedValue({
      proxyRaw: 60,
      qualityFlag: 2,
      isNoData: false,
    });

    const result = await resolveLightPollution({
      latitude: 35.68,
      longitude: 139.76,
      year: 2024,
    });

    expect(result.lightPollutionSource).toBe("black-marble-vnp46a4-gap-filled");
    expect(result.lightPollutionDataLabel).toBe("2024年データ");
  });

  it("no-data の場合は fallback を返す", async () => {
    getBlackMarbleProxy.mockResolvedValue({
      proxyRaw: null,
      qualityFlag: 255,
      isNoData: true,
    });
    fetchGibsPixelBrightness.mockResolvedValue(null);

    const result = await resolveLightPollution({
      latitude: 35.68,
      longitude: 139.76,
      year: 2024,
    });

    expect(result).toEqual({
      lightPollutionProxy: null,
      lightPollutionLevel: "不明",
      lightPollutionSource: "fallback",
      lightPollutionDataLabel: "2024年データ",
    });
  });

  it("BLACK_MARBLE 例外発生時に GIBS が成功した場合は gibs-black-marble を返す", async () => {
    getBlackMarbleProxy.mockRejectedValue(new Error("io failure"));
    fetchGibsPixelBrightness.mockResolvedValue(20); // low brightness

    const result = await resolveLightPollution({
      latitude: 35.68,
      longitude: 139.76,
      year: 2024,
    });

    expect(result).toEqual({
      lightPollutionProxy: 20,
      lightPollutionLevel: "低",
      lightPollutionSource: "gibs-black-marble",
      lightPollutionDataLabel: "2024年データ",
    });
  });

  it.each([
    { brightness: 29, level: "低" },
    { brightness: 30, level: "中" },
    { brightness: 79, level: "中" },
    { brightness: 80, level: "高" },
  ])(
    "GIBS brightness=$brightness の境界値で level=$level を返す",
    async ({ brightness, level }) => {
      getBlackMarbleProxy.mockRejectedValue(new Error("unavailable"));
      fetchGibsPixelBrightness.mockResolvedValue(brightness);

      const result = await resolveLightPollution({
        latitude: 35.68,
        longitude: 139.76,
        year: 2024,
      });

      expect(result.lightPollutionLevel).toBe(level);
      expect(result.lightPollutionSource).toBe("gibs-black-marble");
      expect(result.lightPollutionDataLabel).toBe("2024年データ");
    },
  );

  it("BLACK_MARBLE 例外 & GIBS が null を返した場合は fallback を返す", async () => {
    getBlackMarbleProxy.mockRejectedValue(new Error("unavailable"));
    fetchGibsPixelBrightness.mockResolvedValue(null);

    const result = await resolveLightPollution({
      latitude: 35.68,
      longitude: 139.76,
      year: 2024,
    });

    expect(result).toEqual({
      lightPollutionProxy: null,
      lightPollutionLevel: "不明",
      lightPollutionSource: "fallback",
      lightPollutionDataLabel: "2024年データ",
    });
  });

  it("BLACK_MARBLE 例外 & GIBS 例外の場合は fallback を返す", async () => {
    getBlackMarbleProxy.mockRejectedValue(new Error("unavailable"));
    fetchGibsPixelBrightness.mockRejectedValue(new Error("gibs down"));

    const result = await resolveLightPollution({
      latitude: 35.68,
      longitude: 139.76,
      year: 2024,
    });

    expect(result).toEqual({
      lightPollutionProxy: null,
      lightPollutionLevel: "不明",
      lightPollutionSource: "fallback",
      lightPollutionDataLabel: "2024年データ",
    });
  });
});
