import { XMLParser } from 'fast-xml-parser';

const BASE_URL = 'https://map.yahooapis.jp/geoapi/V1/reverseGeoCoder';
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RETRIES = 3;

/**
 * 緯度経度から住所を取得する
 * @param latitude 緯度
 * @param longitude 経度
 * @returns 住所
 */
export async function getYahooReverseGeocodedAddress(latitude: number, longitude: number): Promise<string> {
    validateCoordinate(latitude, 'latitude');
    validateCoordinate(longitude, 'longitude');

    const params = buildRequestParams(latitude, longitude);
    const fetcher = createFetchClient();
    const xml = await fetchReverseGeocoder(params, fetcher);
    return parseAddressFromXml(xml);
}

function validateCoordinate(value: unknown, label: 'latitude' | 'longitude'): asserts value is number {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
        throw new TypeError(`${label} must be a finite number`);
    }
}

function buildRequestParams(latitude: number, longitude: number): URLSearchParams {
    const appId = process.env.YAHOO_APP_CLIENT_ID;
    if (!appId) {
        throw new Error('YAHOO_APP_CLIENT_ID is not set');
    }

    const params = new URLSearchParams();
    params.set('appid', appId);
    params.set('lat', latitude.toString());
    params.set('lon', longitude.toString());
    params.set('results', '1');
    params.set('datum', 'wgs');
    params.set('output', 'xml');
    return params;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function createFetchClient(): Fetcher {
    return async (input, init = {}) => {
        let attempt = 0;
        let lastError: Error | null = null;

        while (attempt < MAX_RETRIES) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(new Error('Request timeout')), REQUEST_TIMEOUT_MS);

            const result = await fetch(input, { ...init, signal: controller.signal })
                .then(response => {
                    if (response.status === 200) {
                        return { success: true as const, response };
                    }
                    lastError = new Error(`Unexpected status code: ${response.status}`);
                    return { success: false as const };
                })
                .catch(error => {
                    const err = error instanceof Error ? error : new Error('Unknown fetch error');
                    lastError = err;
                    return { success: false as const };
                })
                .finally(() => {
                    clearTimeout(timeout);
                });

            if (result.success) {
                return result.response;
            }
            attempt += 1;
        }
        console.error('Max retries reached. Last error:', lastError);

        throw lastError ?? new Error('Failed to fetch Yahoo Reverse Geocoder API');
    };
}

async function fetchReverseGeocoder(params: URLSearchParams, fetcher: Fetcher): Promise<string> {
    const url = `${BASE_URL}?${params.toString()}`;
    const response = await fetcher(url, { method: 'GET' });
    return response.text();
}

function parseAddressFromXml(xml: string): string {
    if (!xml) {
        throw new Error('Empty response body');
    }

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    const feature = parsed?.YDF?.Feature;

    const featuresArray = Array.isArray(feature) ? feature : feature ? [feature] : [];
    for (const item of featuresArray) {
        const address = item?.Property?.Address;
        if (typeof address === 'string' && address.length > 0) {
            return address;
        }
    }

    throw new Error('Address not found in Yahoo Reverse Geocoder response');
}
