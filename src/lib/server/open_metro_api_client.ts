import { fetchWeatherApi } from 'openmeteo';

type WeatherApiResponse = Awaited<ReturnType<typeof fetchWeatherApi>> extends Array<infer T> ? T : never;

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const DAILY_VARIABLES = 'weather_code,temperature_2m_max,temperature_2m_min';

export interface DailyWeatherSummary {
    /** 対象日 (ISO 8601, YYYY-MM-DD) */
    date: string;
    /** Open-Meteo の weather code */
    weatherCode: number;
    /** 最高気温 (摂氏) */
    temperatureMax: number;
    /** 最低気温 (摂氏) */
    temperatureMin: number;
    /** Open-Meteo が返したタイムゾーン */
    timezone: string;
    /** 晴れ (weather code 0 or 1) かどうか */
    isClearSky: boolean;
}

export async function getDailyWeatherSummary(
    latitude: number,
    longitude: number,
    date: string | Date,
): Promise<DailyWeatherSummary> {
    validateCoordinate(latitude, 'latitude');
    validateCoordinate(longitude, 'longitude');

    const targetDateIso = normaliseDate(date);

    const responses = await fetchWeatherApi(OPEN_METEO_BASE_URL, {
        latitude: [latitude],
        longitude: [longitude],
        daily: DAILY_VARIABLES,
        start_date: targetDateIso,
        end_date: targetDateIso,
        timezone: 'auto',
    });

    if (!responses.length) {
        throw new Error('Open-Meteo API からの応答が空でした');
    }

    return extractSummaryFromResponse(responses[0], targetDateIso);
}

function extractSummaryFromResponse(response: WeatherApiResponse, targetDateIso: string): DailyWeatherSummary {
    const daily = response.daily();
    if (!daily) {
        throw new Error('Open-Meteo API の応答に日次データが含まれていません');
    }

    const utcOffsetSeconds = response.utcOffsetSeconds();
    const weatherCodes = extractVariableValues(daily, 0, 'weather code');
    const temperatureMaxValues = extractVariableValues(daily, 1, 'temperature_2m_max');
    const temperatureMinValues = extractVariableValues(daily, 2, 'temperature_2m_min');
    const targetIndex = findDateIndex(daily, weatherCodes.length, targetDateIso, utcOffsetSeconds);

    if (
        weatherCodes.length <= targetIndex
        || temperatureMaxValues.length <= targetIndex
        || temperatureMinValues.length <= targetIndex
    ) {
        throw new Error('Open-Meteo API から取得したデータに対象日の値が含まれていません');
    }

    const weatherCode = Math.trunc(weatherCodes[targetIndex]);
    const isClearSky = weatherCode === 0 || weatherCode === 1;

    return {
        date: targetDateIso,
        weatherCode,
        temperatureMax: temperatureMaxValues[targetIndex],
        temperatureMin: temperatureMinValues[targetIndex],
        timezone: response.timezone() ?? 'UTC',
        isClearSky,
    };
}

function validateCoordinate(value: unknown, label: 'latitude' | 'longitude'): asserts value is number {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
        throw new TypeError(`${label} must be a finite number`);
    }
}

function normaliseDate(date: string | Date): string {
    if (date instanceof Date) {
        if (Number.isNaN(date.getTime())) {
            throw new TypeError('Invalid Date object was provided');
        }
        return toIsoDate(date);
    }

    if (typeof date === 'string') {
        const parsed = new Date(date);
        if (Number.isNaN(parsed.getTime())) {
            throw new TypeError('date must be a valid ISO 8601 string (YYYY-MM-DD)');
        }
        return toIsoDate(parsed);
    }

    throw new TypeError('date must be a string or Date');
}

function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function extractVariableValues(
    variableSource: NonNullable<ReturnType<WeatherApiResponse['daily']>>,
    index: number,
    label: string,
): number[] {
    const variables = variableSource.variables(index);
    if (!variables) {
        throw new Error(`Open-Meteo API 応答に ${label} が含まれていません`);
    }

    const values = variables.valuesArray();
    if (!values || values.length === 0) {
        throw new Error(`Open-Meteo API の ${label} データが空です`);
    }

    return Array.from(values);
}

function findDateIndex(
    daily: NonNullable<ReturnType<WeatherApiResponse['daily']>>,
    length: number,
    targetDateIso: string,
    utcOffsetSeconds: number,
): number {
    const start = Number(daily.time());
    const interval = daily.interval();

    if (Number.isNaN(start) || interval <= 0) {
        throw new Error('Open-Meteo API の時間情報を解釈できませんでした');
    }

    for (let index = 0; index < length; index += 1) {
        const timestamp = start + index * interval + utcOffsetSeconds;
        const iso = new Date(timestamp * 1000).toISOString().slice(0, 10);
        if (iso === targetDateIso) {
            return index;
        }
    }

    throw new Error('Open-Meteo API から対象日のデータを取得できませんでした');
}

