import { deflateSync } from 'node:zlib';
import {
    GIBS_BRIGHTNESS_HIGH_THRESHOLD,
    GIBS_BRIGHTNESS_LOW_THRESHOLD,
    fetchGibsPixelBrightness,
} from '../gibs_light_pollution_client';

// ---------------------------------------------------------------------------
// Helper: build a minimal valid 1×1 RGB PNG buffer for a given pixel color.
// CRCs are dummied (all zeros) since the parser does not validate them.
// ---------------------------------------------------------------------------
function buildTestPng(r: number, g: number, b: number, filterByte = 0): Buffer {
    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    // IHDR chunk
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(1, 0); // width = 1
    ihdrData.writeUInt32BE(1, 4); // height = 1
    ihdrData.writeUInt8(8, 8); // bit depth = 8
    ihdrData.writeUInt8(2, 9); // color type = 2 (RGB)
    const ihdrLen = Buffer.alloc(4);
    ihdrLen.writeUInt32BE(13, 0);
    const ihdrChunk = Buffer.concat([ihdrLen, Buffer.from('IHDR'), ihdrData, Buffer.alloc(4)]);

    // IDAT chunk: zlib-compress a scanline [filter=0, R, G, B]
    const scanline = Buffer.from([filterByte, r, g, b]);
    const compressed = deflateSync(scanline);
    const idatLen = Buffer.alloc(4);
    idatLen.writeUInt32BE(compressed.length, 0);
    const idatChunk = Buffer.concat([idatLen, Buffer.from('IDAT'), compressed, Buffer.alloc(4)]);

    // IEND chunk
    const iendChunk = Buffer.concat([Buffer.alloc(4), Buffer.from('IEND'), Buffer.alloc(4)]);

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

describe('fetchGibsPixelBrightness', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it.each([
        {
            label: '暗い (低光害)',
            r: 10,
            g: 10,
            b: 10,
            expectedBrightness: 10,
        },
        {
            label: '中程度 (中光害)',
            r: 50,
            g: 50,
            b: 50,
            expectedBrightness: 50,
        },
        {
            label: '明るい (高光害)',
            r: 200,
            g: 150,
            b: 100,
            expectedBrightness: Math.round((200 + 150 + 100) / 3),
        },
    ])('$label ピクセルの平均輝度を返す', async ({ r, g, b, expectedBrightness }) => {
        const pngBuffer = buildTestPng(r, g, b);
        jest.spyOn(global, 'fetch').mockResolvedValue(
            new Response(pngBuffer, {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            }),
        );

        const brightness = await fetchGibsPixelBrightness(35.68, 139.76);

        expect(brightness).toBe(expectedBrightness);
    });

    it('WMS リクエストに正しいパラメータが含まれる', async () => {
        const pngBuffer = buildTestPng(0, 0, 0);
        const mockFetch = jest.spyOn(global, 'fetch').mockResolvedValue(
            new Response(pngBuffer, {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            }),
        );

        await fetchGibsPixelBrightness(34.60, 135.70);

        const calledUrl = (mockFetch.mock.calls[0][0] as string);
        const url = new URL(calledUrl);
        expect(url.searchParams.get('SERVICE')).toBe('WMS');
        expect(url.searchParams.get('REQUEST')).toBe('GetMap');
        expect(url.searchParams.get('WIDTH')).toBe('1');
        expect(url.searchParams.get('HEIGHT')).toBe('1');
        expect(url.searchParams.get('FORMAT')).toBe('image/png');
    });

    it('HTTP エラー時は例外を投げる', async () => {
        jest.spyOn(global, 'fetch').mockResolvedValue(
            new Response('Not Found', { status: 404 }),
        );

        await expect(fetchGibsPixelBrightness(35.68, 139.76)).rejects.toThrow('404');
    });

    it('fetch 自体が失敗した場合は例外を伝播する', async () => {
        jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));

        await expect(fetchGibsPixelBrightness(35.68, 139.76)).rejects.toThrow('network error');
    });

    it('PNG シグネチャ後のバッファが短すぎる場合は null を返す', async () => {
        // PNG signature (8 bytes) + only 17 bytes — offset 24/25 (IHDR bit depth/color type) は範囲外
        const shortBuffer = Buffer.concat([
            Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
            Buffer.alloc(17),
        ]);
        jest.spyOn(global, 'fetch').mockResolvedValue(
            new Response(shortBuffer, {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            }),
        );

        const brightness = await fetchGibsPixelBrightness(35.68, 139.76);

        expect(brightness).toBeNull();
    });

    it('filter byte が 0 以外の場合は null を返す', async () => {
        // filterByte = 1 (Sub filter) — Raw バイトをそのまま RGB として読むと誤値になる
        const pngWithSubFilter = buildTestPng(100, 100, 100, 1);
        jest.spyOn(global, 'fetch').mockResolvedValue(
            new Response(pngWithSubFilter, {
                status: 200,
                headers: { 'Content-Type': 'image/png' },
            }),
        );

        const brightness = await fetchGibsPixelBrightness(35.68, 139.76);

        expect(brightness).toBeNull();
    });
});

describe('brightness thresholds', () => {
    it('GIBS_BRIGHTNESS_LOW_THRESHOLD は 30', () => {
        expect(GIBS_BRIGHTNESS_LOW_THRESHOLD).toBe(30);
    });

    it('GIBS_BRIGHTNESS_HIGH_THRESHOLD は 80', () => {
        expect(GIBS_BRIGHTNESS_HIGH_THRESHOLD).toBe(80);
    });
});
