import { inflateSync } from "node:zlib";

function extractPngPixelBrightness(buffer) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buffer.slice(0, 8).equals(PNG_SIG)) return { error: "Not a PNG" };

  const bitDepth = buffer.readUInt8(24);
  const colorType = buffer.readUInt8(25);

  const idatChunks = [];
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const chunkLen = buffer.readUInt32BE(offset);
    const chunkType = buffer.slice(offset + 4, offset + 8).toString("ascii");
    if (chunkType === "IDAT") idatChunks.push(buffer.slice(offset + 8, offset + 8 + chunkLen));
    if (chunkType === "IEND") break;
    offset += 12 + chunkLen;
  }

  const compressed = Buffer.concat(idatChunks);
  const raw = inflateSync(compressed);
  const filterByte = raw.readUInt8(0);
  const r = raw.readUInt8(1), g = raw.readUInt8(2), b = raw.readUInt8(3);
  const brightness = Math.round((r + g + b) / 3);
  return { bitDepth, colorType, filterByte, r, g, b, brightness };
}

async function testGibs(label, url) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  const result = extractPngPixelBrightness(buf);
  console.log(`[${label}] status=${res.status} contentType=${res.headers.get("content-type")}`);
  console.log(`  => ${JSON.stringify(result)}`);
}

const lat = 35.95, lon = 138.25;
const delta = 0.01;
const bbox4326 = `${lon - delta},${lat - delta},${lon + delta},${lat + delta}`;
const baseParams = "SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=VIIRS_Black_Marble&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=false&TIME=2025-01-01&WIDTH=1&HEIGHT=1";

// パターン1: 現在の実装 (epsg3857エンドポイント + EPSG:4326座標)
await testGibs(
  "epsg3857-endpoint + SRS=4326 (current impl)",
  `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?${baseParams}&SRS=EPSG%3A4326&BBOX=${bbox4326}`
);

// パターン2: epsg4326エンドポイント + EPSG:4326座標
await testGibs(
  "epsg4326-endpoint + SRS=4326",
  `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${baseParams}&SRS=EPSG%3A4326&BBOX=${bbox4326}`
);

// パターン3: Tokyo (都市部) vs 長野(山岳) で差が出るか確認
const tokyoLat = 35.69, tokyoLon = 139.70;
const tokyoBbox = `${tokyoLon - delta},${tokyoLat - delta},${tokyoLon + delta},${tokyoLat + delta}`;
await testGibs(
  "epsg4326-endpoint + Tokyo",
  `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${baseParams}&SRS=EPSG%3A4326&BBOX=${tokyoBbox}`
);

// 山奥（光害ほぼゼロ想定）
const mountainLat = 36.4, mountainLon = 137.6;
const mountainBbox = `${mountainLon - delta},${mountainLat - delta},${mountainLon + delta},${mountainLat + delta}`;
await testGibs(
  "epsg4326-endpoint + Mountain (dark)",
  `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${baseParams}&SRS=EPSG%3A4326&BBOX=${mountainBbox}`
);
