import { deflateSync } from "node:zlib";
import {
  fetchGibsPixelBrightness,
  GIBS_BRIGHTNESS_HIGH_THRESHOLD,
  GIBS_BRIGHTNESS_LOW_THRESHOLD,
  resolveGibsWmsTime,
} from "../gibs_light_pollution_client";

function buildTestPng(
  width: number,
  height: number,
  brightnessValues: number[],
): Buffer {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8);
  ihdrData.writeUInt8(2, 9);
  const ihdrChunk = Buffer.concat([
    Buffer.from([0, 0, 0, 13]),
    Buffer.from("IHDR"),
    ihdrData,
    Buffer.alloc(4),
  ]);

  const rows: Buffer[] = [];
  for (let row = 0; row < height; row += 1) {
    const scanline = Buffer.alloc(1 + width * 3);
    scanline.writeUInt8(0, 0);
    for (let col = 0; col < width; col += 1) {
      const value = brightnessValues[row * width + col] ?? 0;
      const pixelOffset = 1 + col * 3;
      scanline.writeUInt8(value, pixelOffset);
      scanline.writeUInt8(value, pixelOffset + 1);
      scanline.writeUInt8(value, pixelOffset + 2);
    }
    rows.push(scanline);
  }

  const compressed = deflateSync(Buffer.concat(rows));
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

describe("resolveGibsWmsTime", () => {
  afterEach(() => {
    delete process.env.GIBS_WMS_TIME;
  });

  it.each([
    { input: undefined, expected: "2016-01-01" },
    { input: 2024, expected: "2016-01-01" },
    { input: 2016, expected: "2016-01-01" },
    { input: 2014, expected: "2012-01-01" },
  ])("year=$input → $expected", ({ input, expected }) => {
    expect(resolveGibsWmsTime(input)).toBe(expected);
  });

  it("環境変数 GIBS_WMS_TIME が設定されている場合はそれを優先する", () => {
    process.env.GIBS_WMS_TIME = "2019-09-01";

    expect(resolveGibsWmsTime(2024)).toBe("2019-09-01");
  });
});

describe("fetchGibsPixelBrightness", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("3×3 ピクセルの平均輝度を返す", async () => {
    const pngBuffer = buildTestPng(3, 3, [10, 20, 30, 40, 50, 60, 70, 80, 90]);
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(pngBuffer, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );

    const brightness = await fetchGibsPixelBrightness(35.68, 139.76);

    expect(brightness).toBe(50);
  });

  it("WMS リクエストに正しいパラメータが含まれる", async () => {
    const pngBuffer = buildTestPng(3, 3, [0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const mockFetch = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(pngBuffer, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );

    await fetchGibsPixelBrightness(34.6, 135.7, 2024, 6);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    const url = new URL(calledUrl);
    expect(url.searchParams.get("SERVICE")).toBe("WMS");
    expect(url.searchParams.get("REQUEST")).toBe("GetMap");
    expect(url.searchParams.get("WIDTH")).toBe("3");
    expect(url.searchParams.get("HEIGHT")).toBe("3");
    expect(url.searchParams.get("TIME")).toBe("2016-01-01");
    expect(url.searchParams.get("FORMAT")).toBe("image/png");
  });

  it("HTTP エラー時は例外を投げる", async () => {
    jest
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("Not Found", { status: 404 }));

    await expect(fetchGibsPixelBrightness(35.68, 139.76)).rejects.toThrow(
      "404",
    );
  });

  it("fetch 自体が失敗した場合は例外を伝播する", async () => {
    jest.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    await expect(fetchGibsPixelBrightness(35.68, 139.76)).rejects.toThrow(
      "network error",
    );
  });

  it("PNG シグネチャ後のバッファが短すぎる場合は null を返す", async () => {
    const shortBuffer = Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      Buffer.alloc(17),
    ]);
    jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(shortBuffer, {
        status: 200,
        headers: { "Content-Type": "image/png" },
      }),
    );

    const brightness = await fetchGibsPixelBrightness(35.68, 139.76);

    expect(brightness).toBeNull();
  });
});

describe("brightness thresholds", () => {
  it("GIBS_BRIGHTNESS_LOW_THRESHOLD は 30", () => {
    expect(GIBS_BRIGHTNESS_LOW_THRESHOLD).toBe(30);
  });

  it("GIBS_BRIGHTNESS_HIGH_THRESHOLD は 80", () => {
    expect(GIBS_BRIGHTNESS_HIGH_THRESHOLD).toBe(80);
  });
});
