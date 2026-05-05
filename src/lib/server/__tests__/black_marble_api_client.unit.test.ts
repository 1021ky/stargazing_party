import { getBlackMarbleProxy } from "../black_marble_api_client";

describe("getBlackMarbleProxy", () => {
  const originalFetch = global.fetch;
  const originalEndpoint = process.env.BLACK_MARBLE_POINT_QUERY_ENDPOINT;

  beforeEach(() => {
    process.env.BLACK_MARBLE_POINT_QUERY_ENDPOINT =
      "https://example.com/point-query";
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
    process.env.BLACK_MARBLE_POINT_QUERY_ENDPOINT = originalEndpoint;
  });

  it("proxyRaw と qualityFlag を返す", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ proxyRaw: 50, qualityFlag: 1 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getBlackMarbleProxy({
      latitude: 35.68,
      longitude: 139.76,
      year: 2024,
    });

    expect(result).toEqual({
      proxyRaw: 50,
      qualityFlag: 1,
      isNoData: false,
    });
  });

  it("raw=65535 の場合は no-data 扱いにする", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ proxyRaw: 65535, qualityFlag: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getBlackMarbleProxy({
      latitude: 35.68,
      longitude: 139.76,
      year: 2024,
    });

    expect(result).toEqual({
      proxyRaw: null,
      qualityFlag: 0,
      isNoData: true,
    });
  });

  it("quality=255 の場合は no-data 扱いにする", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ proxyRaw: 12, qualityFlag: 255 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await getBlackMarbleProxy({
      latitude: 35.68,
      longitude: 139.76,
      year: 2024,
    });

    expect(result).toEqual({
      proxyRaw: 12,
      qualityFlag: 255,
      isNoData: true,
    });
  });

  it("HTTP エラー時は例外を投げる", async () => {
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "error" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(
      getBlackMarbleProxy({
        latitude: 35.68,
        longitude: 139.76,
        year: 2024,
      }),
    ).rejects.toThrow("Black Marble point query failed with status 503");
  });
});
