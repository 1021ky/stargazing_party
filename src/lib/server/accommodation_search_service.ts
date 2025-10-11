import { getDailyWeatherSummary } from './open_metro_api_client';
import { getPrefectureCoordinates } from './prefecture_geocode';
import { getYahooReverseGeocodedAddress } from './yahoo_reverse_geocoder_api_client';
import { searchHotelsWithAvailability, RakutenHotelAccommodation } from './rakuten_travel_hotel_search_api_client';
import type { Accommodation } from '@/app/_components/AccommodationCard';

export interface StargazingSearchParams {
    date: string | Date;
    prefecture: string;
}

export interface StargazingSearchResult {
    accommodations: Accommodation[];
    resolvedAddress: string;
    latitude: number;
    longitude: number;
    weather: {
        date: string;
        isClearSky: boolean;
        weatherCode: number;
        temperatureMax: number;
        temperatureMin: number;
        timezone: string;
    };
}

export async function searchStargazingAccommodations({ date, prefecture }: StargazingSearchParams): Promise<StargazingSearchResult> {
    const isoDate = normaliseDate(date);
    const coords = getPrefectureCoordinates(prefecture);
    if (!coords) {
        throw new Error(`Unsupported prefecture: ${prefecture}`);
    }

    const [address, weather, hotels] = await Promise.all([
        getYahooReverseGeocodedAddress(coords.latitude, coords.longitude),
        getDailyWeatherSummary(coords.latitude, coords.longitude, isoDate),
        searchHotelsWithAvailability(coords.latitude, coords.longitude, [isoDate]),
    ]);

    const weatherSummary = {
        date: weather.date,
        isClearSky: weather.isClearSky,
        weatherCode: weather.weatherCode,
        temperatureMax: weather.temperatureMax,
        temperatureMin: weather.temperatureMin,
        timezone: weather.timezone,
    };

    if (!weather.isClearSky) {
        return {
            accommodations: [],
            resolvedAddress: address,
            latitude: coords.latitude,
            longitude: coords.longitude,
            weather: weatherSummary,
        };
    }

    const filtered = hotels
        .filter((hotel) => hotel.availableRooms > 0)
        .map((hotel) => enrichHotelWithLocation(hotel, address));

    const sorted = filtered.sort((a, b) => b.rating - a.rating || b.clearSkyProbability - a.clearSkyProbability);

    return {
        accommodations: sorted,
        resolvedAddress: address,
        latitude: coords.latitude,
        longitude: coords.longitude,
        weather: weatherSummary,
    };
}

function normaliseDate(date: string | Date): string {
    if (date instanceof Date) {
        if (Number.isNaN(date.getTime())) {
            throw new TypeError('Invalid Date object provided');
        }
        return toIsoDate(date);
    }

    if (typeof date === 'string') {
        const trimmed = date.trim();
        if (!trimmed) {
            throw new TypeError('date must not be empty');
        }
        const parsed = new Date(trimmed);
        if (Number.isNaN(parsed.getTime())) {
            throw new TypeError('date must be a valid ISO 8601 string (YYYY-MM-DD)');
        }
        return toIsoDate(parsed);
    }

    throw new TypeError('date must be a string or Date instance');
}

function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function enrichHotelWithLocation(hotel: RakutenHotelAccommodation, resolvedAddress: string): Accommodation {
    return {
        ...hotel,
        location: hotel.location || resolvedAddress,
        prefecture: hotel.prefecture || extractPrefectureFromAddress(resolvedAddress) || '不明',
    };
}

function extractPrefectureFromAddress(address: string): string | null {
    const match = address.match(/(.+?[都道府県])/u);
    return match ? match[1] : null;
}
