import { resolveLightPollution } from "../light_pollution_service";

jest.mock("../gibs_light_pollution_client", () => ({
  fetchGibsPixelBrightness: jest.fn(),
  resolveGibsWmsTime: jest.fn().mockReturnValue("2016-01-01"),
  GIBS_BRIGHTNESS_LOW_THRESHOLD: 30,
  GIBS_BRIGHTNESS_HIGH_THRESHOLD: 80,
}));

describe("resolveLightPollution", () => {
  const { fetchGibsPixelBrightness, resolveGibsWmsTime } = jest.requireMock(
    "../gibs_light_pollution_client",
  );

  beforeEach(() => {
    jest.resetAllMocks();
    resolveGibsWmsTime.mockReturnValue("2016-01-01");
  });

  it.each([
    { brightness: 29, level: "低" },
    { brightness: 30, level: "中" },
    { brightness: 79, level: "中" },
    { brightness: 80, level: "高" },
  ])(
    "GIBS brightness=$brightness の境界値で level=$level を返す",
    async ({ brightness, level }) => {
      fetchGibsPixelBrightness.mockResolvedValue(brightness);

      const result = await resolveLightPollution({
        latitude: 35.68,
        longitude: 139.76,
        year: 2024,
      });

      expect(result).toEqual({
        lightPollutionProxy: brightness,
        lightPollutionLevel: level,
        lightPollutionSource: "gibs-black-marble",
        lightPollutionDataLabel: "2016年データ",
      });
      expect(resolveGibsWmsTime).toHaveBeenCalledWith(2024, undefined);
    },
  );

  it("brightness が null の場合は fallback を返す", async () => {
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
      lightPollutionDataLabel: "2016年データ",
    });
  });

  it("GIBS 例外の場合は fallback を返す", async () => {
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
      lightPollutionDataLabel: "2016年データ",
    });
  });

  it("month が渡されても GIBS の時刻解決に影響しない", async () => {
    fetchGibsPixelBrightness.mockResolvedValue(55);

    const result = await resolveLightPollution({
      latitude: 35.68,
      longitude: 139.76,
      year: 2024,
      month: 6,
    });

    expect(result).toEqual({
      lightPollutionProxy: 55,
      lightPollutionLevel: "中",
      lightPollutionSource: "gibs-black-marble",
      lightPollutionDataLabel: "2016年データ",
    });
    expect(resolveGibsWmsTime).toHaveBeenCalledWith(2024, 6);
  });
});
