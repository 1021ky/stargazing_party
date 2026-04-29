import { getBlackMarbleProxy } from "./black_marble_api_client";
import {
    fetchGibsPixelBrightness,
    GIBS_BRIGHTNESS_HIGH_THRESHOLD,
    GIBS_BRIGHTNESS_LOW_THRESHOLD,
} from "./gibs_light_pollution_client";

export type LightPollutionLevel = "低" | "中" | "高" | "不明";
export type LightPollutionSource =
    | "black-marble-vnp46a4"
    | "black-marble-vnp46a4-gap-filled"
    | "gibs-black-marble-2016"
    | "fallback";

export interface ResolveLightPollutionParams {
    latitude: number;
    longitude: number;
    year?: number;
}

export interface LightPollutionResult {
    lightPollutionProxy: number | null;
    lightPollutionLevel: LightPollutionLevel;
    lightPollutionSource: LightPollutionSource;
}

const DEFAULT_DATASET_YEAR = 2024;

export async function resolveLightPollution({
    latitude,
    longitude,
    year,
}: ResolveLightPollutionParams): Promise<LightPollutionResult> {
    const targetYear = resolveTargetYear(year);

    try {
        const { proxyRaw, qualityFlag, isNoData } = await getBlackMarbleProxy({
            latitude,
            longitude,
            year: targetYear,
        });

        if (isNoData || proxyRaw === null) {
            return fallbackResult();
        }

        return {
            lightPollutionProxy: proxyRaw,
            lightPollutionLevel: classifyLightPollutionLevel(proxyRaw),
            lightPollutionSource: resolveSourceFromQuality(qualityFlag),
        };
    } catch {
        // BLACK_MARBLE_POINT_QUERY_ENDPOINT not set or request failed — try GIBS
    }

    try {
        const brightness = await fetchGibsPixelBrightness(latitude, longitude);
        if (brightness === null) {
            return fallbackResult();
        }
        return {
            lightPollutionProxy: brightness,
            lightPollutionLevel: classifyGibsBrightness(brightness),
            lightPollutionSource: "gibs-black-marble-2016",
        };
    } catch (error) {
        console.warn(
            "Failed to resolve light pollution from GIBS. Falling back.",
            error,
        );
        return fallbackResult();
    }
}

function classifyLightPollutionLevel(proxy: number): LightPollutionLevel {
    if (proxy < 40) {
        return "低";
    }
    if (proxy < 120) {
        return "中";
    }
    return "高";
}

function resolveSourceFromQuality(
    qualityFlag: number | null,
): LightPollutionSource {
    if (qualityFlag === 2) {
        return "black-marble-vnp46a4-gap-filled";
    }
    return "black-marble-vnp46a4";
}

function resolveTargetYear(year?: number): number {
    if (typeof year === "number" && Number.isFinite(year)) {
        return year;
    }

    const fromEnv = Number.parseInt(
        process.env.BLACK_MARBLE_DATASET_YEAR ?? "",
        10,
    );
    if (Number.isFinite(fromEnv)) {
        return fromEnv;
    }

    return DEFAULT_DATASET_YEAR;
}

function classifyGibsBrightness(brightness: number): LightPollutionLevel {
    if (brightness < GIBS_BRIGHTNESS_LOW_THRESHOLD) {
        return "低";
    }
    if (brightness < GIBS_BRIGHTNESS_HIGH_THRESHOLD) {
        return "中";
    }
    return "高";
}

function fallbackResult(): LightPollutionResult {
    return {
        lightPollutionProxy: null,
        lightPollutionLevel: "不明",
        lightPollutionSource: "fallback",
    };
}
