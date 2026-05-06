import { formatLightPollutionDataLabel } from "@/lib/light_pollution_baseline";
import {
  fetchGibsPixelBrightness,
  GIBS_BRIGHTNESS_HIGH_THRESHOLD,
  GIBS_BRIGHTNESS_LOW_THRESHOLD,
  resolveGibsWmsTime,
} from "./gibs_light_pollution_client";

export type LightPollutionLevel = "低" | "中" | "高" | "不明";
export type LightPollutionSource = "gibs-black-marble" | "fallback";

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
  const gibsTime = resolveGibsWmsTime(year, month);
  const gibsDataLabel = formatLightPollutionDataLabel(gibsTime);

  try {
    const brightness = await fetchGibsPixelBrightness(
      latitude,
      longitude,
      year,
      month,
    );
    if (brightness === null) {
      return fallbackResult(gibsDataLabel);
    }
    const level = classifyGibsBrightness(brightness);
    return {
      lightPollutionProxy: brightness,
      lightPollutionLevel: level,
      lightPollutionSource: "gibs-black-marble",
      lightPollutionDataLabel: gibsDataLabel,
    };
  } catch (_error) {
    return fallbackResult(gibsDataLabel);
  }
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
