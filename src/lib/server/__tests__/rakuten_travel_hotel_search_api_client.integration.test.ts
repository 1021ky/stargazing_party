import { searchHotelsWithAvailability } from '../rakuten_travel_hotel_search_api_client';

const TOKYO_STATION_LATITUDE = 35.681236;
const TOKYO_STATION_LONGITUDE = 139.767125;
const describeOrSkip = process.env.RAKUTEN_TRAVEL_APPLICATION_ID ? describe : describe.skip;

describeOrSkip('searchHotelsWithAvailability (integration)', () => {
    beforeAll(() => {
        jest.setTimeout(30_000);
    });

    it('周辺の宿泊施設を取得できる', async () => {
        const hotels = await searchHotelsWithAvailability(
            TOKYO_STATION_LATITUDE,
            TOKYO_STATION_LONGITUDE,
        );

        expect(Array.isArray(hotels)).toBe(true);
        expect(hotels.length).toBeGreaterThan(0);
        const [first] = hotels;
        expect(first).toEqual(
            expect.objectContaining({
                id: expect.any(String),
                name: expect.any(String),
                prefecture: expect.any(String),
                price: expect.any(Number),
            }),
        );
    });
});
