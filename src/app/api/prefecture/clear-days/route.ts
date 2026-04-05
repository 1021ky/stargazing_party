import { NextResponse } from 'next/server';
import { getDailyWeatherSummariesRange } from '@/lib/server/open_metro_api_client';
import { getPrefectureCoordinates } from '@/lib/server/prefecture_geocode';

// TODO: WINDOWS_DAYSだけで実現する。
const WINDOW_DAYS = 15;
const PUBLIC_ALLOWED_MIN = process.env.NEXT_PUBLIC_OPEN_METEO_ALLOWED_START_DATE_MIN;
const PUBLIC_ALLOWED_MAX = process.env.NEXT_PUBLIC_OPEN_METEO_ALLOWED_START_DATE_MAX;
const SERVER_ALLOWED_MIN = process.env.OPEN_METEO_ALLOWED_START_DATE_MIN ?? PUBLIC_ALLOWED_MIN;
const SERVER_ALLOWED_MAX = process.env.OPEN_METEO_ALLOWED_START_DATE_MAX ?? PUBLIC_ALLOWED_MAX;

interface ClearDaysResponseDay {
    date: string;
    isClearSky: boolean;
    weatherCode: number;
    temperatureMax: number;
    temperatureMin: number;
}

function toUtcIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}

function addDaysUtcIso(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return toUtcIsoDate(date);
}

function maxIso(a: string, b: string): string {
    return a > b ? a : b;
}

function minIso(a: string, b: string): string {
    return a < b ? a : b;
}

function computeWindowBounds(): { start: string | null; end: string | null; isOutOfSupportedRange: boolean } {
    const todayIso = toUtcIsoDate(new Date());

    if (SERVER_ALLOWED_MAX && todayIso > SERVER_ALLOWED_MAX) {
        return { start: null, end: null, isOutOfSupportedRange: true };
    }

    const start = SERVER_ALLOWED_MIN ? maxIso(todayIso, SERVER_ALLOWED_MIN) : todayIso;
    const tentativeEnd = addDaysUtcIso(start, WINDOW_DAYS - 1);
    const end = SERVER_ALLOWED_MAX ? minIso(tentativeEnd, SERVER_ALLOWED_MAX) : tentativeEnd;

    if (end < start) {
        return { start: null, end: null, isOutOfSupportedRange: true };
    }

    return { start, end, isOutOfSupportedRange: false };
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
        const { start, end, isOutOfSupportedRange } = windowBounds;

        if (isOutOfSupportedRange || !start || !end) {
            return NextResponse.json({
                prefecture,
                startDate: null,
                endDate: null,
                days: [] as ClearDaysResponseDay[],
                availability: 'out_of_supported_range',
                message: '現在の提供期間外のため晴れ予報を表示できません。',
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
