import { getBlackMarbleProxy } from "./black_marble_api_client";
import {
  fetchGibsPixelBrightness,
  GIBS_BRIGHTNESS_HIGH_THRESHOLD,
  GIBS_BRIGHTNESS_LOW_THRESHOLD,
  resolveGibsWmsTime,
} from "./gibs_light_pollution_client";
import {
  formatLightPollutionDataLabel,
  resolveLightPollutionBaseYear,
} from "@/lib/light_pollution_baseline";

export type LightPollutionLevel = "低" | "中" | "高" | "不明";
export type LightPollutionSource =
  | "black-marble-vnp46a4"
  | "black-marble-vnp46a4-gap-filled"
  | "gibs-black-marble"
  | "fallback";

export interface ResolveLightPollutionParams {
  latitude: number;
  longitude: number;
  year?: number;
  month?: number;
}

export interface LightPollutionResult {
  lightPollutionProxy: number | null;
  lightPollutionLevel: LightPollutionLevel;
  lightPollutionSource: LightPollutionSource;
  lightPollutionDataLabel: string;
}

export async function resolveLightPollution({
  latitude,
  longitude,
  year,
  month,
}: ResolveLightPollutionParams): Promise<LightPollutionResult> {
  const targetYear = resolveLightPollutionBaseYear(year);
  const annualDataLabel = formatLightPollutionDataLabel(`${targetYear}-01-01`);
  const label = `[DEBUG:LightPollution] lat=${latitude.toFixed(4)} lon=${longitude.toFixed(4)} year=${targetYear}`;
  console.log(`${label} - Starting...`);

  try {
    console.log(`${label} - Trying Black Marble...`);
    const { proxyRaw, qualityFlag, isNoData } = await getBlackMarbleProxy({
      latitude,
      longitude,
      year: targetYear,
    });

    if (isNoData || proxyRaw === null) {
      console.log(
        `${label} - Black Marble: isNoData=${isNoData}, proxyRaw=${proxyRaw} → GIBS fallback`,
      );
      // Fall through to GIBS
    } else {
      const level = classifyLightPollutionLevel(proxyRaw);
      const source = resolveSourceFromQuality(qualityFlag);
      console.log(
        `${label} - Black Marble SUCCESS: proxy=${proxyRaw} level=${level} source=${source}`,
      );
      return {
        lightPollutionProxy: proxyRaw,
        lightPollutionLevel: level,
        lightPollutionSource: source,
        lightPollutionDataLabel: annualDataLabel,
      };
    }
  } catch (err) {
    console.log(`${label} - Black Marble FAILED: ${(err as Error).message}`);
    // Fall through to GIBS
  }

  try {
    console.log(`${label} - Trying GIBS...`);
    const gibsTime = resolveGibsWmsTime(targetYear, month);
    const brightness = await fetchGibsPixelBrightness(
      latitude,
      longitude,
      targetYear,
      month,
    );
    if (brightness === null) {
      console.log(`${label} - GIBS: brightness=null → using fallback`);
      return fallbackResult(annualDataLabel);
    }
    const level = classifyGibsBrightness(brightness);
    console.log(
      `${label} - GIBS SUCCESS: brightness=${brightness} level=${level}`,
    );
    return {
      lightPollutionProxy: brightness,
      lightPollutionLevel: level,
      lightPollutionSource: "gibs-black-marble",
      lightPollutionDataLabel: formatLightPollutionDataLabel(gibsTime),
    };
  } catch (error) {
    console.log(`${label} - GIBS FAILED: ${(error as Error).message}`);
    console.log(`${label} - Using fallback...`);
    return fallbackResult(annualDataLabel);
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

function classifyGibsBrightness(brightness: number): LightPollutionLevel {
  if (brightness < GIBS_BRIGHTNESS_LOW_THRESHOLD) {
    return "低";
  }
  if (brightness < GIBS_BRIGHTNESS_HIGH_THRESHOLD) {
    return "中";
  }
  return "高";
}

function fallbackResult(lightPollutionDataLabel: string): LightPollutionResult {
  return {
    lightPollutionProxy: null,
    lightPollutionLevel: "不明",
    lightPollutionSource: "fallback",
    lightPollutionDataLabel,
  };
}
