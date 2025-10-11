import { NextResponse } from 'next/server';
import { searchStargazingAccommodations } from '@/lib/server/accommodation_search_service';

interface SearchRequestBody {
    date: string;
    prefecture: string;
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as Partial<SearchRequestBody>;
        const date = body?.date;
        const prefecture = body?.prefecture;

        if (!date || !prefecture) {
            return NextResponse.json({ message: 'date and prefecture are required' }, { status: 400 });
        }

        const result = await searchStargazingAccommodations({ date, prefecture });

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        if (error instanceof TypeError) {
            return NextResponse.json({ message: error.message }, { status: 400 });
        }
        if (error instanceof Error) {
            const status = error.message.startsWith('Unsupported prefecture') ? 400 : 500;
            return NextResponse.json({ message: error.message }, { status });
        }
        return NextResponse.json({ message: 'Unknown error occurred' }, { status: 500 });
    }
}
