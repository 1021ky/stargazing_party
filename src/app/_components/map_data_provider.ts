import type { Feature, FeatureCollection, Geometry } from "geojson";

type PrefectureProperties = {
  prefecture?: string;
};

type PrefectureFeature = Feature<Geometry, PrefectureProperties>;

type PrefectureFeatureCollection = FeatureCollection<
  Geometry,
  PrefectureProperties
>;

const PREFECTURE_GEOJSON_PATH = "/geo/prefectures.geojson";
const LOAD_ERROR_MESSAGE = "地図データの読み込みに失敗しました";

function isFeatureCollection(
  value: unknown,
): value is PrefectureFeatureCollection {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as { type?: unknown; features?: unknown };
  return record.type === "FeatureCollection" && Array.isArray(record.features);
}

function normalizeFeatures(
  features: Array<PrefectureFeature | null>,
): PrefectureFeature[] {
  const normalized: PrefectureFeature[] = [];

  for (const feature of features) {
    if (!feature) {
      continue;
    }

    const prefecture = feature.properties?.prefecture;
    if (typeof prefecture !== "string" || prefecture.length === 0) {
      continue;
    }

    normalized.push({
      ...feature,
      properties: {
        ...feature.properties,
        prefecture,
      },
    });
  }

  return normalized;
}

export async function loadPrefectureGeoJSON(): Promise<PrefectureFeatureCollection> {
  const response = await fetch(PREFECTURE_GEOJSON_PATH);
  if (!response.ok) {
    throw new Error(LOAD_ERROR_MESSAGE);
  }

  const payload = (await response.json()) as unknown;
  if (!isFeatureCollection(payload)) {
    throw new Error(LOAD_ERROR_MESSAGE);
  }

  const normalized = normalizeFeatures(
    payload.features as Array<PrefectureFeature | null>,
  );
  return {
    type: "FeatureCollection",
    features: normalized,
  };
}

export const mapDataProviderErrors = {
  LOAD_ERROR_MESSAGE,
};
