const BLACK_MARBLE_SDS_NAME = 'NearNadir_Composite_Snow_Free';
const BLACK_MARBLE_QUALITY_SDS_NAME = 'NearNadir_Composite_Snow_Free_Quality';
const BLACK_MARBLE_FILL_VALUE = 65535;
const BLACK_MARBLE_NO_DATA_QUALITY = 255;

interface BlackMarblePointQueryResponse {
    proxyRaw?: unknown;
    value?: unknown;
    qualityFlag?: unknown;
    quality?: unknown;
}

export interface BlackMarbleProxyParams {
    latitude: number;
    longitude: number;
    year: number;
}

export interface BlackMarbleProxyResult {
    proxyRaw: number | null;
    qualityFlag: number | null;
    isNoData: boolean;
}

export async function getBlackMarbleProxy({
    latitude,
    longitude,
    year,
}: BlackMarbleProxyParams): Promise<BlackMarbleProxyResult> {
    validateFiniteNumber(latitude, 'latitude');
    validateFiniteNumber(longitude, 'longitude');
    validateFiniteNumber(year, 'year');

    const endpoint = process.env.BLACK_MARBLE_POINT_QUERY_ENDPOINT;
    if (!endpoint) {
        throw new Error('BLACK_MARBLE_POINT_QUERY_ENDPOINT is not set');
    }

    const url = new URL(endpoint);
    url.searchParams.set('latitude', latitude.toString());
    url.searchParams.set('longitude', longitude.toString());
    url.searchParams.set('year', year.toString());
    url.searchParams.set('sdsName', BLACK_MARBLE_SDS_NAME);
    url.searchParams.set('qualitySdsName', BLACK_MARBLE_QUALITY_SDS_NAME);

    const response = await fetch(url.toString(), { method: 'GET' });
    if (!response.ok) {
        throw new Error(`Black Marble point query failed with status ${response.status}`);
    }

    const payload = (await response.json()) as BlackMarblePointQueryResponse;
    const proxyRaw = pickNumber(payload.proxyRaw ?? payload.value);
    const qualityFlag = pickNumber(payload.qualityFlag ?? payload.quality);

    const proxyIsNoData = proxyRaw === BLACK_MARBLE_FILL_VALUE || proxyRaw === null;
    const qualityIsNoData = qualityFlag === BLACK_MARBLE_NO_DATA_QUALITY;

    return {
        proxyRaw: proxyIsNoData ? null : proxyRaw,
        qualityFlag,
        isNoData: proxyIsNoData || qualityIsNoData,
    };
}

function validateFiniteNumber(value: number, label: string): void {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
        throw new TypeError(`${label} must be a finite number`);
    }
}

function pickNumber(value: unknown): number | null {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
        return null;
    }
    return value;
}
