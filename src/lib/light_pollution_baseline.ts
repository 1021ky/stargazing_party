const YEAR_PATTERN = /^\d{4}$/;
const MONTH_PATTERN = /^(1[0-2]|[1-9])$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const STABLE_YEAR_LAG = 1;

export function resolveLightPollutionBaseYear(explicitYear?: number): number {
  if (typeof explicitYear === "number" && Number.isFinite(explicitYear)) {
    return explicitYear;
  }

  const fromEnv = [
    process.env.LIGHT_POLLUTION_BASE_YEAR,
    process.env.NEXT_PUBLIC_LIGHT_POLLUTION_BASE_YEAR,
    process.env.BLACK_MARBLE_DATASET_YEAR,
  ]
    .map((value) => parseYear(value))
    .find((value) => value !== null);

  if (fromEnv !== undefined) {
    return fromEnv ?? latestStableYear();
  }

  return latestStableYear();
}

export function resolveLightPollutionBaseMonth(explicitMonth?: number): number {
  if (
    typeof explicitMonth === "number" &&
    Number.isFinite(explicitMonth) &&
    explicitMonth >= 1 &&
    explicitMonth <= 12
  ) {
    return explicitMonth;
  }

  const fromEnv = parseMonth(process.env.LIGHT_POLLUTION_BASE_MONTH);
  if (fromEnv !== null) {
    return fromEnv;
  }

  return 1;
}

export function resolveLightPollutionBaseDate(
  baseYear?: number,
  baseMonth?: number,
): string {
  const fromEnv = [
    process.env.LIGHT_POLLUTION_BASE_DATE,
    process.env.NEXT_PUBLIC_LIGHT_POLLUTION_BASE_DATE,
    process.env.GIBS_WMS_TIME,
  ]
    .map((value) => parseDate(value))
    .find((value) => value !== null);

  if (fromEnv) {
    return fromEnv;
  }

  const year = resolveLightPollutionBaseYear(baseYear);
  const month = resolveLightPollutionBaseMonth(baseMonth);
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function formatLightPollutionDataLabel(date: string): string {
  const match = DATE_PATTERN.exec(date);
  if (!match) {
    return "データ時点: 不明";
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  if (month === 1 && day === 1) {
    return `${year}年データ`;
  }

  if (day === 1) {
    return `${year}年${month}月データ`;
  }

  return `${year}年${month}月${day}日データ`;
}

function latestStableYear(now: Date = new Date()): number {
  return now.getUTCFullYear() - STABLE_YEAR_LAG;
}

function parseYear(value: string | undefined): number | null {
  if (!value || !YEAR_PATTERN.test(value.trim())) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function parseMonth(value: string | undefined): number | null {
  if (!value || !MONTH_PATTERN.test(value.trim())) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 12) {
    return null;
  }

  return parsed;
}

function parseDate(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!DATE_PATTERN.test(trimmed)) {
    return null;
  }

  return trimmed;
}
