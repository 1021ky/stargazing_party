import { NextResponse } from 'next/server';
import { getDailyWeatherSummariesRange } from '@/lib/server/open_metro_api_client';
import { getPrefectureCoordinates } from '@/lib/server/prefecture_geocode';

// TODO: WINDOWS_DAYSだけで実現する。
const WINDOW_DAYS = 15;
const PUBLIC_ALLOWED_MIN = process.env.NEXT_PUBLIC_OPEN_METEO_ALLOWED_START_DATE_MIN ?? '2025-07-10';
const PUBLIC_ALLOWED_MAX = process.env.NEXT_PUBLIC_OPEN_METEO_ALLOWED_START_DATE_MAX ?? '2025-10-26';
const SERVER_ALLOWED_MIN = process.env.OPEN_METEO_ALLOWED_START_DATE_MIN ?? PUBLIC_ALLOWED_MIN;
const SERVER_ALLOWED_MAX = process.env.OPEN_METEO_ALLOWED_START_DATE_MAX ?? PUBLIC_ALLOWED_MAX;

interface ClearDaysResponseDay {
    date: string;
    isClearSky: boolean;
    weatherCode: number;
    temperatureMax: number;
    temperatureMin: number;
}

function toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function computeWindowBounds(): { start: string; end: string } {
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const minAllowed = new Date(`${SERVER_ALLOWED_MIN}T00:00:00Z`);
    const maxAllowed = new Date(`${SERVER_ALLOWED_MAX}T00:00:00Z`);

    const windowStartDate = todayStart > minAllowed ? todayStart : minAllowed;
    const tentativeEnd = new Date(windowStartDate);
    tentativeEnd.setDate(tentativeEnd.getDate() + (WINDOW_DAYS - 1));

    const windowEndDate = tentativeEnd < maxAllowed ? tentativeEnd : maxAllowed;

    if (windowEndDate < windowStartDate) {
        return {
            start: toIsoDate(windowStartDate),
            end: toIsoDate(windowStartDate),
        };
    }

    return {
        start: toIsoDate(windowStartDate),
        end: toIsoDate(windowEndDate),
    };
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    const prefecture = url.searchParams.get('prefecture') ?? '';

    if (!prefecture) {
        return NextResponse.json({ message: 'prefecture is required' }, { status: 400 });
    }

    try {
        const coords = getPrefectureCoordinates(prefecture);
        if (!coords) {
            return NextResponse.json({ message: `Unsupported prefecture: ${prefecture}` }, { status: 400 });
        }

        const windowBounds = computeWindowBounds();
        const { start, end } = windowBounds;

        if (start > end) {
            return NextResponse.json({
                prefecture,
                startDate: start,
                endDate: end,
                days: [] as ClearDaysResponseDay[],
            });
        }

        const summaries = await getDailyWeatherSummariesRange(coords.latitude, coords.longitude, start, end);
        const days: ClearDaysResponseDay[] = summaries.map((summary) => ({
            date: summary.date,
            isClearSky: summary.isClearSky,
            weatherCode: summary.weatherCode,
            temperatureMax: summary.temperatureMax,
            temperatureMin: summary.temperatureMin,
        }));

        return NextResponse.json({
            prefecture,
            startDate: start,
            endDate: end,
            days,
        });
    } catch (error) {
        if (error instanceof RangeError) {
            return NextResponse.json({ message: error.message }, { status: 400 });
        }
        const message = error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ message }, { status: 500 });
    }
}
