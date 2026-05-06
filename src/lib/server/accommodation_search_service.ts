import type { Accommodation } from "@/app/_components/AccommodationCard";
import { resolveLightPollution } from "./light_pollution_service";
import { getDailyWeatherSummary } from "./open_metro_api_client";
import { getPrefectureCoordinates } from "./prefecture_geocode";
import {
  type RakutenHotelAccommodation,
  searchHotelsWithAvailability,
} from "./rakuten_travel_hotel_search_api_client";
import { getYahooReverseGeocodedAddress } from "./yahoo_reverse_geocoder_api_client";

export interface StargazingSearchParams {
  date: string | Date;
  prefecture?: string;
  bounds?: SearchBounds;
  filters?: SearchFilters;
}

export interface SearchBounds {
  minLatitude: number;
  maxLatitude: number;
  minLongitude: number;
  maxLongitude: number;
}

export interface SearchFilters {
  maxPrice?: number;
  minRating?: number;
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

export async function searchStargazingAccommodations({
  date,
  prefecture,
  bounds,
  filters,
}: StargazingSearchParams): Promise<StargazingSearchResult> {
  const isoDate = normaliseDate(date);
  const coords = resolveSearchCoordinates({ prefecture, bounds });

  const [address, weather, hotels] = await Promise.all([
    getYahooReverseGeocodedAddress(coords.latitude, coords.longitude),
    getDailyWeatherSummary(coords.latitude, coords.longitude, isoDate),
    searchHotelsWithFallback(coords.latitude, coords.longitude, isoDate),
  ]);

  const weatherSummary = {
    date: weather.date,
    isClearSky: weather.isClearSky,
    weatherCode: weather.weatherCode,
    temperatureMax: weather.temperatureMax,
    temperatureMin: weather.temperatureMin,
    timezone: weather.timezone,
  };

  const filtered = applyFilters(hotels, filters).filter(
    (hotel) => hotel.availableRooms > 0,
  );

  const enriched = await Promise.all(
    filtered.map(async (hotel) => {
      const pollution = await resolveLightPollution({
        latitude: hotel.latitude ?? coords.latitude,
        longitude: hotel.longitude ?? coords.longitude,
      });
      return enrichHotelWithLocation(hotel, address, pollution);
    }),
  );

  const sorted = enriched.sort(
    (a, b) =>
      b.rating - a.rating || b.clearSkyProbability - a.clearSkyProbability,
  );

  return {
    accommodations: sorted,
    resolvedAddress: address,
    latitude: coords.latitude,
    longitude: coords.longitude,
    weather: weatherSummary,
  };
}

async function searchHotelsWithFallback(
  latitude: number,
  longitude: number,
  isoDate: string,
): Promise<RakutenHotelAccommodation[]> {
  try {
    return await searchHotelsWithAvailability(latitude, longitude, [isoDate]);
  } catch (error) {
    console.warn(
      "Rakuten hotel search failed. Returning empty accommodations.",
      error,
    );
    return [];
  }
}

function resolveSearchCoordinates({
  prefecture,
  bounds,
}: Pick<StargazingSearchParams, "prefecture" | "bounds">): {
  latitude: number;
  longitude: number;
} {
  if (bounds) {
    return computeCenterFromBounds(bounds);
  }

  if (!prefecture) {
    throw new TypeError("prefecture or bounds is required");
  }

  const coords = getPrefectureCoordinates(prefecture);
  if (!coords) {
    throw new Error(`Unsupported prefecture: ${prefecture}`);
  }

  return coords;
}

function computeCenterFromBounds(bounds: SearchBounds): {
  latitude: number;
  longitude: number;
} {
  const latitude = (bounds.minLatitude + bounds.maxLatitude) / 2;
  const longitude = (bounds.minLongitude + bounds.maxLongitude) / 2;
  return { latitude, longitude };
}

function applyFilters(
  hotels: RakutenHotelAccommodation[],
  filters?: SearchFilters,
): RakutenHotelAccommodation[] {
  const maxPrice =
    typeof filters?.maxPrice === "number" ? filters.maxPrice : null;
  const minRating =
    typeof filters?.minRating === "number" ? filters.minRating : null;

  return hotels.filter((hotel) => {
    const priceOk = maxPrice === null || hotel.price <= maxPrice;
    const ratingOk = minRating === null || hotel.rating >= minRating;
    return priceOk && ratingOk;
  });
}

function normaliseDate(date: string | Date): string {
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) {
      throw new TypeError("Invalid Date object provided");
    }
    return toIsoDate(date);
  }

  if (typeof date === "string") {
    const trimmed = date.trim();
    if (!trimmed) {
      throw new TypeError("date must not be empty");
    }
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new TypeError("date must be a valid ISO 8601 string (YYYY-MM-DD)");
    }
    return toIsoDate(parsed);
  }

  throw new TypeError("date must be a string or Date instance");
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function enrichHotelWithLocation(
  hotel: RakutenHotelAccommodation,
  resolvedAddress: string,
  pollution: {
    lightPollutionProxy: number | null;
    lightPollutionLevel: Accommodation["lightPollutionLevel"];
    lightPollutionSource: Accommodation["lightPollutionSource"];
    lightPollutionDataLabel: Accommodation["lightPollutionDataLabel"];
  },
): Accommodation {
  const { latitude: _latitude, longitude: _longitude, ...baseHotel } = hotel;

  return {
    ...baseHotel,
    location: hotel.location || resolvedAddress,
    prefecture:
      hotel.prefecture ||
      extractPrefectureFromAddress(resolvedAddress) ||
      "不明",
    lightPollutionProxy: pollution.lightPollutionProxy,
    lightPollutionLevel: pollution.lightPollutionLevel,
    lightPollutionSource: pollution.lightPollutionSource,
    lightPollutionDataLabel: pollution.lightPollutionDataLabel,
  };
}

function extractPrefectureFromAddress(address: string): string | null {
  const match = address.match(/(.+?[都道府県])/u);
  return match ? match[1] : null;
}
