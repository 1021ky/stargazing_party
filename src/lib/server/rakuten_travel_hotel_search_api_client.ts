const BASE_URL = 'https://app.rakuten.co.jp/services/api/Travel/SimpleHotelSearch/20170426';
const REQUEST_TIMEOUT_MS = 5_000;
const MAX_RETRIES = 3;
const SEARCH_RADIUS_KM = 30;
const SYNODIC_MONTH_DAYS = 29.530588853;

type LightPollutionLevel = '低' | '中' | '高';

export interface RakutenHotelAccommodation {
    id: string;
    name: string;
    location: string;
    prefecture: string;
    newMoonDate: string;
    clearSkyProbability: number;
    price: number;
    rating: number;
    availableRooms: number;
    imageUrl: string;
    lightPollution: LightPollutionLevel;
    altitude: number;
}

interface RakutenApiResponseError {
    error?: string;
    error_description?: string;
}

interface RakutenHotelWrapper {
    hotel?: Array<{
        hotelBasicInfo?: RakutenHotelBasicInfo;
        hotelDetailInfo?: RakutenHotelDetailInfo;
        hotelRatingInfo?: RakutenHotelRatingInfo;
    }>;
    hotelBasicInfo?: RakutenHotelBasicInfo;
    hotelDetailInfo?: RakutenHotelDetailInfo;
    hotelRatingInfo?: RakutenHotelRatingInfo;
}

interface RakutenHotelBasicInfo {
    hotelNo?: number;
    hotelName?: string;
    address1?: string;
    address2?: string;
    latitude?: number;
    longitude?: number;
    hotelMinCharge?: number;
    reviewAverage?: number | string;
    reviewCount?: number;
    hotelImageUrl?: string;
    hotelThumbnailUrl?: string;
    nearestStation?: string;
}

interface RakutenHotelDetailInfo {
    roomCount?: number;
}

interface RakutenHotelRatingInfo {
    locationAverage?: number;
    serviceAverage?: number;
    roomAverage?: number;
    totalScore?: number;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export async function searchHotelsWithAvailability(
    latitude: number,
    longitude: number,
    stayDates: Array<string | Date>,
): Promise<RakutenHotelAccommodation[]> {
    validateCoordinate(latitude, 'latitude');
    validateCoordinate(longitude, 'longitude');
    const normalisedStayDates = normaliseStayDates(stayDates);
    if (normalisedStayDates.length === 0) {
        throw new Error('stayDates must contain at least one date');
    }

    const fetcher = createFetchClient();
    const accommodations = await Promise.all(
        normalisedStayDates.map(async stayDate => {
            const params = buildRequestParams(latitude, longitude, stayDate);
            const data = await fetchRakutenHotels(params, fetcher);
            return transformHotelsToAccommodation(data, stayDate);
        }),
    );

    return mergeAccommodations(accommodations.flat());
}

function validateCoordinate(value: unknown, label: 'latitude' | 'longitude'): asserts value is number {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
        throw new TypeError(`${label} must be a finite number`);
    }
}

function buildRequestParams(latitude: number, longitude: number, stayDate: string): URLSearchParams {
    const appId = process.env.RAKUTEN_TRAVEL_APPLICATION_ID;
    if (!appId) {
        throw new Error('RAKUTEN_TRAVEL_APPLICATION_ID is not set');
    }

    const params = new URLSearchParams();
    params.set('applicationId', appId);
    params.set('format', 'json');
    params.set('formatVersion', '1');
    params.set('latitude', latitude.toString());
    params.set('longitude', longitude.toString());
    params.set('searchRadius', SEARCH_RADIUS_KM.toString());
    params.set('vacancy', '1');
    params.set('datumType', '1');
    params.set('hits', '10');
    params.set('checkinDate', stayDate);
    return params;
}

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
        throw lastError ?? new Error('Failed to fetch Rakuten Travel Simple Hotel Search API');
    };
}

async function fetchRakutenHotels(params: URLSearchParams, fetcher: Fetcher): Promise<unknown> {
    const url = `${BASE_URL}?${params.toString()}`;
    const response = await fetcher(url, { method: 'GET' });
    return response.json();
}

function transformHotelsToAccommodation(payload: unknown, stayDate: string): RakutenHotelAccommodation[] {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Rakuten Travel API response is not valid JSON');
    }

    const { error, error_description: errorDescription } = payload as RakutenApiResponseError;
    if (error) {
        throw new Error(errorDescription ?? error);
    }

    const hotels = Array.isArray((payload as { hotels?: RakutenHotelWrapper[] }).hotels)
        ? ((payload as { hotels?: RakutenHotelWrapper[] }).hotels as RakutenHotelWrapper[])
        : [];

    return hotels
        .map(wrapper => extractAccommodationFromWrapper(wrapper, stayDate))
        .filter((item): item is RakutenHotelAccommodation => item !== null);
}

function extractAccommodationFromWrapper(wrapper: RakutenHotelWrapper, stayDate: string): RakutenHotelAccommodation | null {
    const hotelEntries = Array.isArray(wrapper.hotel) ? wrapper.hotel : [];

    const basicInfo = hotelEntries.find(entry => entry.hotelBasicInfo)?.hotelBasicInfo
        ?? wrapper.hotelBasicInfo
        ?? undefined;
    const detailInfo = hotelEntries.find(entry => entry.hotelDetailInfo)?.hotelDetailInfo
        ?? wrapper.hotelDetailInfo
        ?? undefined;
    const ratingInfo = hotelEntries.find(entry => entry.hotelRatingInfo)?.hotelRatingInfo
        ?? wrapper.hotelRatingInfo
        ?? undefined;

    if (!basicInfo || !basicInfo.hotelNo || !basicInfo.hotelName) {
        return null;
    }

    const prefectureAndCity = extractPrefectureAndCity(basicInfo.address1 ?? '');
    const prefecture = prefectureAndCity.prefecture || '不明';
    const cityOrWard = prefectureAndCity.city;

    const locationCandidates = [cityOrWard, basicInfo.address2, basicInfo.nearestStation]
        .map(value => (typeof value === 'string' ? value.trim() : ''))
        .filter(value => value.length > 0);
    const location = locationCandidates.join(' ') || prefecture;

    const rating = normaliseNumber(basicInfo.reviewAverage ?? ratingInfo?.totalScore ?? 0, 1);
    const clearSkyProbability = estimateClearSkyProbability(rating, ratingInfo?.locationAverage);
    const availableRooms = detailInfo?.roomCount && detailInfo.roomCount > 0 ? detailInfo.roomCount : 1;

    const latitude = typeof basicInfo.latitude === 'number' ? basicInfo.latitude : null;
    const altitude = latitude !== null ? estimateAltitudeFromLatitude(latitude) : 0;
    const imageUrl = chooseImageUrl(basicInfo);

    return {
        id: String(basicInfo.hotelNo),
        name: basicInfo.hotelName,
        location,
        prefecture,
        newMoonDate: formatNextNewMoonDate(new Date(stayDate)),
        clearSkyProbability,
        price: normaliseNumber(basicInfo.hotelMinCharge ?? 0, 0),
        rating,
        availableRooms,
        imageUrl,
        lightPollution: determineLightPollutionLevel(ratingInfo?.locationAverage, latitude),
        altitude,
    };
}

function mergeAccommodations(accommodations: RakutenHotelAccommodation[]): RakutenHotelAccommodation[] {
    const merged = new Map<string, RakutenHotelAccommodation>();

    for (const accommodation of accommodations) {
        const existing = merged.get(accommodation.id);
        if (!existing) {
            merged.set(accommodation.id, accommodation);
            continue;
        }

        const combinedAvailableRooms = existing.availableRooms + accommodation.availableRooms;
        const betterRating = accommodation.rating > existing.rating ? accommodation.rating : existing.rating;
        const betterClearSky = Math.max(existing.clearSkyProbability, accommodation.clearSkyProbability);
        const newMoonDate = existing.newMoonDate <= accommodation.newMoonDate ? existing.newMoonDate : accommodation.newMoonDate;

        merged.set(accommodation.id, {
            ...existing,
            availableRooms: combinedAvailableRooms,
            rating: betterRating,
            clearSkyProbability: betterClearSky,
            newMoonDate,
        });
    }

    return Array.from(merged.values());
}

function normaliseStayDates(stayDates: Array<string | Date>): string[] {
    if (!Array.isArray(stayDates)) {
        throw new TypeError('stayDates must be an array of string or Date');
    }

    return stayDates.map(date => normaliseDateInput(date)).filter((value, index, array) => array.indexOf(value) === index);
}

function normaliseDateInput(value: string | Date): string {
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) {
            throw new TypeError('Invalid Date object was provided in stayDates');
        }
        return toIsoDate(value);
    }

    if (typeof value === 'string') {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            throw new TypeError('stayDates must only contain ISO 8601 date strings (YYYY-MM-DD) or Date objects');
        }
        return toIsoDate(parsed);
    }

    throw new TypeError('stayDates must only contain string or Date values');
}

function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function extractPrefectureAndCity(address: string): { prefecture: string; city: string } {
    const trimmed = address.trim();
    if (!trimmed) {
        return { prefecture: '', city: '' };
    }

    const match = trimmed.match(/^(.+?[都道府県])(.*)$/u);
    if (match) {
        const [, prefecture, city] = match;
        return { prefecture: prefecture.trim(), city: city.trim() };
    }

    return { prefecture: trimmed, city: '' };
}

function normaliseNumber(value: number | string, digits: number): number {
    const parsed = typeof value === 'string' ? Number.parseFloat(value) : value;
    if (!Number.isFinite(parsed)) {
        return 0;
    }
    return Number(parsed.toFixed(digits));
}

function estimateClearSkyProbability(reviewAverage: number, locationAverage?: number): number {
    const base = Number.isFinite(locationAverage) ? locationAverage ?? 0 : reviewAverage;
    const probability = Math.min(95, Math.max(40, Math.round(base * 18)));
    return probability;
}

function determineLightPollutionLevel(locationAverage?: number, latitude?: number | null): LightPollutionLevel {
    if (Number.isFinite(locationAverage)) {
        if ((locationAverage ?? 0) >= 4.5) {
            return '低';
        }
        if ((locationAverage ?? 0) >= 3.5) {
            return '中';
        }
        return '高';
    }

    if (typeof latitude === 'number') {
        if (latitude >= 40 || latitude <= 30) {
            return '低';
        }
        return '中';
    }

    return '中';
}

function estimateAltitudeFromLatitude(latitude: number): number {
    const base = Math.max(0, Math.abs(latitude - 35));
    return Math.round(base * 120);
}

function chooseImageUrl(info: RakutenHotelBasicInfo): string {
    if (info.hotelImageUrl && info.hotelImageUrl.length > 0) {
        return info.hotelImageUrl;
    }
    if (info.hotelThumbnailUrl && info.hotelThumbnailUrl.length > 0) {
        return info.hotelThumbnailUrl;
    }
    return 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1080&q=80';
}

function formatNextNewMoonDate(referenceDate = new Date()): string {
    const referenceNewMoon = new Date('2024-01-11T11:57:00Z');
    const msPerDay = 86_400_000;
    const diffDays = (referenceDate.getTime() - referenceNewMoon.getTime()) / msPerDay;
    const cycles = Number.isFinite(diffDays) ? Math.max(0, Math.ceil(diffDays / SYNODIC_MONTH_DAYS)) : 0;
    const nextNewMoon = new Date(referenceNewMoon.getTime() + cycles * SYNODIC_MONTH_DAYS * msPerDay);
    const formatter = new Intl.DateTimeFormat('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    return formatter.format(nextNewMoon);
}


