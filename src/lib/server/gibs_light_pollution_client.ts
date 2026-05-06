import { inflateSync } from "node:zlib";
import { resolveGibsLightPollutionDate } from "@/lib/light_pollution_baseline";

const GIBS_WMS_ENDPOINT =
  "https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi";
const GIBS_LAYER = "VIIRS_Black_Marble";
const GIBS_SAMPLE_SIZE = 3;

// Brightness thresholds derived from VIIRS nighttime radiance range in the layer
// Low: dark rural/mountain areas, Mid: small cities/suburbs, High: urban cores
export const GIBS_BRIGHTNESS_LOW_THRESHOLD = 30;
export const GIBS_BRIGHTNESS_HIGH_THRESHOLD = 80;

export function resolveGibsWmsTime(
  baseYear?: number,
  _baseMonth?: number,
): string {
  return resolveGibsLightPollutionDate(baseYear);
}

/**
 * Fetches a small PNG from the GIBS WMS endpoint for the given coordinates
 * and returns the average RGB brightness (0–255) across the image.
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
  url.searchParams.set("WIDTH", String(GIBS_SAMPLE_SIZE));
  url.searchParams.set("HEIGHT", String(GIBS_SAMPLE_SIZE));
  url.searchParams.set("SRS", "EPSG:4326");
  url.searchParams.set("BBOX", bbox);

  const response = await fetch(url.toString(), { method: "GET" });
  if (!response.ok) {
    throw new Error(`GIBS WMS request failed with status ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return extractPngAverageBrightness(buffer);
}

/**
 * Parses a PNG buffer and returns the average RGB brightness across all pixels.
 * PNG structure: 8-byte signature + chunks (length, type, data, crc).
 * IDAT chunk contains zlib-compressed scanlines; filter byte precedes each row.
 */
function extractPngAverageBrightness(buffer: Buffer): number | null {
  // PNG signature: 8 bytes
  const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.slice(0, 8).equals(PNG_SIGNATURE)) {
    return null;
  }

  // IHDR data starts at offset 16 (8 sig + 4 len + 4 type); width/height/bitDepth/colorType are in the data block.
  if (buffer.length < 33) {
    return null;
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);

  // Only handle 8-bit RGB (colorType=2) and RGBA (colorType=6)
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    return null;
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const rowLength = 1 + width * bytesPerPixel;

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
  if (raw.length !== height * rowLength) {
    return null;
  }

  const pixels: number[] = [];
  let previousRow: Buffer<ArrayBufferLike> = Buffer.alloc(
    width * bytesPerPixel,
  );

  for (let row = 0; row < height; row += 1) {
    const rowOffset = row * rowLength;
    const filterByte = raw.readUInt8(rowOffset);
    const scanline = raw.subarray(rowOffset + 1, rowOffset + rowLength);
    const reconstructed = unfilterScanline(
      filterByte,
      scanline,
      previousRow,
      bytesPerPixel,
    );
    if (reconstructed === null) {
      return null;
    }

    for (let column = 0; column < width; column += 1) {
      const pixelOffset = column * bytesPerPixel;
      const r = reconstructed.readUInt8(pixelOffset);
      const g = reconstructed.readUInt8(pixelOffset + 1);
      const b = reconstructed.readUInt8(pixelOffset + 2);
      pixels.push(Math.round((r + g + b) / 3));
    }

    previousRow = reconstructed;
  }

  if (pixels.length === 0) {
    return null;
  }

  const sum = pixels.reduce((accumulator, value) => accumulator + value, 0);
  return Math.round(sum / pixels.length);
}

function unfilterScanline(
  filterByte: number,
  scanline: Buffer<ArrayBufferLike>,
  previousRow: Buffer<ArrayBufferLike>,
  bytesPerPixel: number,
): Buffer<ArrayBufferLike> | null {
  const reconstructed: Buffer<ArrayBufferLike> = Buffer.alloc(scanline.length);

  for (let index = 0; index < scanline.length; index += 1) {
    const rawValue = scanline.readUInt8(index);
    const left =
      index >= bytesPerPixel
        ? reconstructed.readUInt8(index - bytesPerPixel)
        : 0;
    const up = previousRow.readUInt8(index);
    const upLeft =
      index >= bytesPerPixel ? previousRow.readUInt8(index - bytesPerPixel) : 0;

    let value: number;
    switch (filterByte) {
      case 0:
        value = rawValue;
        break;
      case 1:
        value = rawValue + left;
        break;
      case 2:
        value = rawValue + up;
        break;
      case 3:
        value = rawValue + Math.floor((left + up) / 2);
        break;
      case 4:
        value = rawValue + paethPredictor(left, up, upLeft);
        break;
      default:
        return null;
    }

    reconstructed.writeUInt8(value & 0xff, index);
  }

  return reconstructed;
}

function paethPredictor(left: number, up: number, upLeft: number): number {
  const prediction = left + up - upLeft;
  const distanceLeft = Math.abs(prediction - left);
  const distanceUp = Math.abs(prediction - up);
  const distanceUpLeft = Math.abs(prediction - upLeft);

  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) {
    return left;
  }

  if (distanceUp <= distanceUpLeft) {
    return up;
  }

  return upLeft;
}
