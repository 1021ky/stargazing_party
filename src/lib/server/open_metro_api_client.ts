import { fetchWeatherApi } from 'openmeteo';
import * as dns from 'dns';
import * as https from 'https';

type WeatherApiResponse = Awaited<ReturnType<typeof fetchWeatherApi>> extends Array<infer T> ? T : never;

const OPEN_METEO_BASE_URL = 'https://api.open-meteo.com/v1/forecast';
const DAILY_VARIABLES = 'weather_code,temperature_2m_max,temperature_2m_min';
const HOURLY_VARIABLES = 'weather_code,is_day,temperature_2m';
const MAX_FETCH_RETRIES = 3;
const RETRY_DELAY_MS = 1_000;

// Open‑Meteo が許容する start_date の範囲（API の仕様 / 応答に基づく）
// 注意: 将来的に変わる可能性があるため、必要なら環境変数や設定で上書きできるようにする。
const OPEN_METEO_ALLOWED_START_DATE_MIN = process.env.OPEN_METEO_ALLOWED_START_DATE_MIN ?? '2025-07-10';
const OPEN_METEO_ALLOWED_START_DATE_MAX = process.env.OPEN_METEO_ALLOWED_START_DATE_MAX ?? '2025-10-26';

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

    // Open-Meteo の仕様により start_date は利用可能なレンジに限定される。
    // ここで明示的にバリデーションを行い、クライアント側で早期にエラーを返す。
    const minAllowed = OPEN_METEO_ALLOWED_START_DATE_MIN;
    const maxAllowed = OPEN_METEO_ALLOWED_START_DATE_MAX;
    if (targetDateIso < minAllowed || targetDateIso > maxAllowed) {
        throw new RangeError(`start_date must be within ${minAllowed} and ${maxAllowed}`);
    }

    const responses = await fetchWeatherWithRetry({
        latitude,
        longitude,
        daily: DAILY_VARIABLES,
        hourly: HOURLY_VARIABLES,
        start_date: targetDateIso,
        end_date: targetDateIso,
        timezone: 'Asia/Tokyo',
    });
    if (!responses.length) {
        throw new Error('Open-Meteo API からの応答が空でした');
    }

    const summaries = extractSummariesFromResponse(responses[0], targetDateIso, targetDateIso);
    if (!summaries.length) {
        throw new Error('Open-Meteo API から対象日のデータを取得できませんでした');
    }

    return summaries[0];
}

export async function getDailyWeatherSummariesRange(
    latitude: number,
    longitude: number,
    startDate: string | Date,
    endDate: string | Date,
): Promise<DailyWeatherSummary[]> {
    validateCoordinate(latitude, 'latitude');
    validateCoordinate(longitude, 'longitude');

    const startIso = normaliseDate(startDate);
    const endIso = normaliseDate(endDate);

    if (startIso > endIso) {
        throw new RangeError('startDate must be earlier than or equal to endDate');
    }

    const minAllowed = OPEN_METEO_ALLOWED_START_DATE_MIN;
    const maxAllowed = OPEN_METEO_ALLOWED_START_DATE_MAX;
    if (startIso < minAllowed || endIso > maxAllowed) {
        throw new RangeError(`date range must be within ${minAllowed} and ${maxAllowed}`);
    }

    const responses = await fetchWeatherWithRetry({
        latitude,
        longitude,
        daily: DAILY_VARIABLES,
        hourly: HOURLY_VARIABLES,
        start_date: startIso,
        end_date: endIso,
        timezone: 'Asia/Tokyo',
    });

    if (!responses.length) {
        throw new Error('Open-Meteo API からの応答が空でした');
    }

    return extractSummariesFromResponse(responses[0], startIso, endIso);
}

async function fetchWeatherWithRetry(params: Parameters<typeof fetchWeatherApi>[1]): Promise<Awaited<ReturnType<typeof fetchWeatherApi>>> {
    let attempt = 0;
    let lastError: unknown;

    console.log('Fetching weather with params:', params);
    while (attempt < MAX_FETCH_RETRIES) {
        try {
            // 注意:
            // 2025-10-11 時点の観測では、api.open-meteo.com は IPv4 経路でのみ応答し、
            // IPv6 経路では接続が確立できない（curl -4 は成功、-6 は失敗）ことが確認した。
            // Node のグローバル fetch が環境によっては IPv6 を優先して使ってタイムアウトすることがあるため、ここでは明示的に IPv4 を優先する。
            // 接続時には元のホスト名を SNI (servername) と
            // Host ヘッダに設定して TLS と仮想ホスティングの互換性を保つ。
            const json = await fetchOpenMeteoByIp(params, RETRY_DELAY_MS * attempt + 10000);
            console.log('Fetched weather JSON:', JSON.stringify(json));
            const adapter = buildAdapterFromJson(json);
            const pretty = revealAdapter(adapter);
            console.dir(pretty, { depth: null });
            return [adapter] as unknown as Awaited<ReturnType<typeof fetchWeatherApi>>;
        }
        catch (err) {
            lastError = err;
            attempt += 1;
            if (attempt >= MAX_FETCH_RETRIES) {
                const message = lastError instanceof Error ? lastError.message : 'Unknown error';
                throw new Error(`Open-Meteo API へのアクセスに失敗しました (${message})`);
            }
            await delay(RETRY_DELAY_MS * attempt);
        }
    }

    throw new Error('Open-Meteo API へのアクセスに失敗しました');
}
// 関数プロパティを呼んで可読なオブジェクトに変換してログ出力する例
function revealAdapter(adapter: any) {
    const daily = typeof adapter.daily === 'function' ? adapter.daily() : adapter.daily;
    const hourly = typeof adapter.hourly === 'function' ? adapter.hourly() : adapter.hourly;
    const utcOffsetSeconds = typeof adapter.utcOffsetSeconds === 'function' ? adapter.utcOffsetSeconds() : adapter.utcOffsetSeconds;
    const timezone = typeof adapter.timezone === 'function' ? adapter.timezone() : adapter.timezone;

    const dailyObj = {
        startTimestamp: typeof daily.time === 'function' ? daily.time() : daily.time,
        intervalSeconds: typeof daily.interval === 'function' ? daily.interval() : daily.interval,
        weather_code: daily.variables?.(0)?.valuesArray?.() ?? null,
        temperature_2m_max: daily.variables?.(1)?.valuesArray?.() ?? null,
        temperature_2m_min: daily.variables?.(2)?.valuesArray?.() ?? null,
    };

    const hourlyObj = hourly
        ? {
            startTimestamp: typeof hourly.time === 'function' ? hourly.time() : hourly.time,
            intervalSeconds: typeof hourly.interval === 'function' ? hourly.interval() : hourly.interval,
            weather_code: hourly.variables?.(0)?.valuesArray?.() ?? null,
            temperature_2m: hourly.variables?.(1)?.valuesArray?.() ?? null,
            is_day: hourly.variables?.(2)?.valuesArray?.() ?? null,
        }
        : null;

    return { utcOffsetSeconds, timezone, daily: dailyObj, hourly: hourlyObj };
}
// params オブジェクトから Open-Meteo リクエスト用の URL 文字列を構築する
function buildUrlFromParams(params: Record<string, unknown>): string {
    const u = new URL(OPEN_METEO_BASE_URL);
    const sp = u.searchParams;
    for (const [k, v] of Object.entries(params)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) {
            for (const it of v) sp.append(k, String(it));
        }
        else {
            sp.set(k, String(v));
        }
    }
    return u.toString();
}

async function fetchOpenMeteoByIp(params: Parameters<typeof fetchWeatherApi>[1], timeoutMs = 10000): Promise<any> {
    // api.open-meteo.com を解決し、IPv4 を優先して選択する（Open‑Meteo は現状 IPv4 のみ応答するため）
    const host = new URL(OPEN_METEO_BASE_URL).hostname;
    const addrs = await dns.promises.lookup(host, { all: true });
    const v4 = addrs.find(a => a.family === 4) ?? addrs[0];
    if (!v4) throw new Error('DNS lookup failed for Open-Meteo');
    const ip = v4.address;

    const url = buildUrlFromParams(params as Record<string, unknown>);
    const u = new URL(url);

    return await new Promise<any>((resolve, reject) => {
        const opts: https.RequestOptions = {
            host: ip,
            port: 443,
            path: `${u.pathname}${u.search}`,
            method: 'GET',
            headers: {
                Host: host,
                Accept: 'application/json',
                'User-Agent': 'node-fetch',
            },
            servername: host, // SNI (サーバー名インジケータ)
            timeout: timeoutMs,
        };

        const req = https.request(opts, res => {
            const bufs: Buffer[] = [];
            res.on('data', d => bufs.push(Buffer.from(d)));
            res.on('end', () => {
                try {
                    const body = Buffer.concat(bufs).toString('utf8');
                    const json = JSON.parse(body);
                    resolve(json);
                }
                catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('timeout')));
        req.end();
    });
}

function buildAdapterFromJson(json: any) {
    // extractSummaryFromResponse で使用されるメソッドを提供する最小限のアダプタ
    // 関数プロパティにしているのは、処理速度とメモリ使用量の向上のため
    return {
        __raw: json,
        daily: () => {
            const daily = json.daily || {};
            return {
                variables: (index: number) => {
                    const map: Record<number, any[]> = {
                        0: daily.weather_code,
                        1: daily.temperature_2m_max,
                        2: daily.temperature_2m_min,
                    };
                    const arr = map[index];
                    if (!arr) return null;
                    return {
                        valuesArray: () => Array.from(arr as any[]),
                    };
                },
                time: () => {
                    const t = daily.time;
                    if (!t || t.length === 0) return NaN;
                    return Math.floor(new Date(t[0]).getTime() / 1000);
                },
                interval: () => {
                    const t = daily.time;
                    if (!t || t.length < 2) return 86400;
                    return Math.floor((new Date(t[1]).getTime() - new Date(t[0]).getTime()) / 1000);
                },
            };
        },
        hourly: () => {
            const hourly = json.hourly || {};
            return {
                variables: (index: number) => {
                    const map: Record<number, any[]> = {
                        0: hourly.weather_code,
                        1: hourly.temperature_2m,
                        2: hourly.is_day,
                    };
                    const arr = map[index];
                    if (!arr) return null;
                    return {
                        valuesArray: () => Array.from(arr as any[]),
                    };
                },
                time: () => {
                    const t = hourly.time;
                    if (!t || t.length === 0) return NaN;
                    return Math.floor(new Date(t[0]).getTime() / 1000);
                },
                interval: () => {
                    const t = hourly.time;
                    if (!t || t.length < 2) return 3600;
                    return Math.floor((new Date(t[1]).getTime() - new Date(t[0]).getTime()) / 1000);
                },
                isoTimes: () => Array.isArray(hourly.time) ? Array.from(hourly.time) : [],
            };
        },
        utcOffsetSeconds: () => (json.utc_offset_seconds ?? 0),
        timezone: () => (json.timezone ?? null),
    };
}

function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

function extractSummariesFromResponse(response: WeatherApiResponse, targetStartIso: string, targetEndIso: string): DailyWeatherSummary[] {
    try {
        const pretty = revealAdapter(response);
        console.dir(pretty, { depth: null });
    } catch (e) {
        // 変換に失敗した場合はフォールバックで raw オブジェクトを出力する
        console.log('Open-Meteo API response (raw):', response);
    }
    const daily = response.daily();
    if (!daily) {
        throw new Error('Open-Meteo API の応答に日次データが含まれていません');
    }

    const utcOffsetSeconds = response.utcOffsetSeconds();
    const weatherCodes = extractVariableValues(daily, 0, 'weather code');
    const temperatureMaxValues = extractVariableValues(daily, 1, 'temperature_2m_max');
    const temperatureMinValues = extractVariableValues(daily, 2, 'temperature_2m_min');
    const length = Math.min(weatherCodes.length, temperatureMaxValues.length, temperatureMinValues.length);
    if (!Number.isFinite(length) || length <= 0) {
        throw new Error('Open-Meteo API の日次データ長が不正です');
    }

    const startTimestamp = Number(daily.time());
    const interval = daily.interval();

    if (Number.isNaN(startTimestamp) || interval <= 0) {
        throw new Error('Open-Meteo API の時間情報を解釈できませんでした');
    }

    const timezone = response.timezone() ?? 'UTC';
    const rawJson = (response as unknown as { __raw?: any }).__raw;
    const summaries: DailyWeatherSummary[] = [];

    for (let index = 0; index < length; index += 1) {
        const timestamp = startTimestamp + index * interval + utcOffsetSeconds;
        const iso = new Date(timestamp * 1000).toISOString().slice(0, 10);
        if (iso < targetStartIso || iso > targetEndIso) {
            continue;
        }

        const weatherCode = Math.trunc(weatherCodes[index]);
        const baseIsClearSky = weatherCode === 0 || weatherCode === 1;
        const hourlyClearSky = determineNightClearSky(rawJson, iso);
        const isClearSky = typeof hourlyClearSky === 'boolean' ? hourlyClearSky : baseIsClearSky;

        summaries.push({
            date: iso,
            weatherCode,
            temperatureMax: temperatureMaxValues[index],
            temperatureMin: temperatureMinValues[index],
            timezone,
            isClearSky,
        });
    }

    if (!summaries.length) {
        throw new Error('Open-Meteo API から対象期間のデータを取得できませんでした');
    }

    summaries.sort((a, b) => a.date.localeCompare(b.date));
    return summaries;
}

function extractSummaryFromResponse(response: WeatherApiResponse, targetDateIso: string): DailyWeatherSummary {
    const summaries = extractSummariesFromResponse(response, targetDateIso, targetDateIso);
    const summary = summaries[0];
    console.log('Extracted DailyWeatherSummary:', summary);
    return summary;
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

function determineNightClearSky(rawJson: any, targetDateIso: string): boolean | null {
    if (!rawJson || !rawJson.hourly) {
        return null;
    }

    const { time, weather_code: weatherCodes, is_day: isDayFlags } = rawJson.hourly;

    if (!Array.isArray(time) || !Array.isArray(weatherCodes) || !Array.isArray(isDayFlags)) {
        return null;
    }

    const length = Math.min(time.length, weatherCodes.length, isDayFlags.length);
    let nightSamples = 0;
    let clearSamples = 0;

    for (let i = 0; i < length; i += 1) {
        const iso = typeof time[i] === 'string' ? time[i] : String(time[i]);
        const datePart = iso.slice(0, 10);
        if (datePart !== targetDateIso) {
            continue;
        }

        const isNight = Number(isDayFlags[i]) === 0;
        if (!isNight) {
            continue;
        }

        nightSamples += 1;
        const code = Number(weatherCodes[i]);
        if (code === 0 || code === 1) {
            clearSamples += 1;
        }
    }

    if (nightSamples === 0) {
        return null;
    }

    return clearSamples / nightSamples >= 0.8;
}

