import { inflateSync } from "node:zlib";
import { resolveLightPollutionBaseDate } from "@/lib/light_pollution_baseline";


const GIBS_WMS_ENDPOINT =
  "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";
const GIBS_LAYER = "VIIRS_Black_Marble";

// Brightness thresholds derived from VIIRS nighttime radiance range in the layer
// Low: dark rural/mountain areas, Mid: small cities/suburbs, High: urban cores
export const GIBS_BRIGHTNESS_LOW_THRESHOLD = 30;
export const GIBS_BRIGHTNESS_HIGH_THRESHOLD = 80;

export function resolveGibsWmsTime(baseYear?: number, baseMonth?: number): string {
  return resolveLightPollutionBaseDate(baseYear, baseMonth);
}

/**
 * Fetches a 1×1 pixel PNG from the GIBS WMS endpoint for the given coordinates
 * and returns the average RGB brightness (0–255).
 * Returns null if the request fails or the PNG cannot be parsed.
 */
export async function fetchGibsPixelBrightness(
  latitude: number,
  longitude: number,
  baseYear?: number,
  baseMonth?: number,
): Promise<number | null> {
  const delta = 0.01;
  const bbox = `${longitude - delta},${latitude - delta},${longitude + delta},${latitude + delta}`;
  const label = `[DEBUG:GIBS] lat=${latitude.toFixed(4)} lon=${longitude.toFixed(4)}`;
  console.log(`${label} - bbox=${bbox}`);

  const gibsTime = resolveGibsWmsTime(baseYear, baseMonth);
  const url = new URL(GIBS_WMS_ENDPOINT);
  url.searchParams.set("SERVICE", "WMS");
  url.searchParams.set("REQUEST", "GetMap");
  url.searchParams.set("VERSION", "1.1.1");
  url.searchParams.set("LAYERS", GIBS_LAYER);
  url.searchParams.set("STYLES", "");
  url.searchParams.set("FORMAT", "image/png");
  url.searchParams.set("TRANSPARENT", "false");
  url.searchParams.set("TIME", gibsTime);
  url.searchParams.set("WIDTH", "1");
  url.searchParams.set("HEIGHT", "1");
  url.searchParams.set("SRS", "EPSG:4326");
  url.searchParams.set("BBOX", bbox);

  console.log(`${label} - Request URL: ${url.toString()}`);
  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    console.log(`${label} - HTTP error: ${response.status}`);
    throw new Error(`GIBS WMS request failed with status ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const brightness = extractPngPixelBrightness(buffer);
  console.log(`${label} - Extracted brightness: ${brightness}`);
  return brightness;
}

/**
 * Parses a minimal PNG buffer and returns the average RGB brightness of the first pixel.
 * PNG structure: 8-byte signature + chunks (length, type, data, crc).
 * IDAT chunk contains zlib-compressed scanlines; filter byte precedes each row.
 */
function extractPngPixelBrightness(buffer: Buffer): number | null {
  // PNG signature: 8 bytes
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.slice(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }

  // IHDR data starts at offset 16 (8 sig + 4 len + 4 type); bitDepth at 24, colorType at 25
  if (buffer.length < 26) {
    return null;
  }

  // Read IHDR to get color type and bit depth
  // IHDR chunk starts at offset 8: 4(len) + 4(type) + 13(data) + 4(crc)
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);

  // Only handle 8-bit RGB (colorType=2) and RGBA (colorType=6)
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    return null;
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;

  // Collect all IDAT chunk data
  const idatChunks: Buffer[] = [];
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const chunkLen = buffer.readUInt32BE(offset);
    const chunkType = buffer.slice(offset + 4, offset + 8).toString("ascii");
    if (chunkType === "IDAT") {
      idatChunks.push(buffer.slice(offset + 8, offset + 8 + chunkLen));
    }
    if (chunkType === "IEND") {
      break;
    }
    offset += 12 + chunkLen;
  }

  if (idatChunks.length === 0) {
    return null;
  }

  const compressed = Buffer.concat(idatChunks);
  let raw: Buffer;
  try {
    raw = inflateSync(compressed);
  } catch {
    return null;
  }

  // Each scanline: 1 filter byte + width * bytesPerPixel bytes
  // For a 1×1 image: raw = [filterByte, R, G, B, (A)]
  if (raw.length < 1 + bytesPerPixel) {
    return null;
  }

  // Only handle Filter type 0 (None). Other filter types require row reconstruction
  // which is unnecessary for 1×1 images and may yield incorrect RGB values.
  const filterByte = raw.readUInt8(0);
  if (filterByte !== 0) {
    return null;
  }

  const r = raw.readUInt8(1);
  const g = raw.readUInt8(2);
  const b = raw.readUInt8(3);

  return Math.round((r + g + b) / 3);
}
