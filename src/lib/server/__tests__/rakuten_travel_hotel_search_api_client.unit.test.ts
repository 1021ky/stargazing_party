import { searchHotelsWithAvailability } from '../rakuten_travel_hotel_search_api_client';

describe('searchHotelsWithAvailability (unit)', () => {
    const originalFetch = global.fetch;
    const originalAppId = process.env.RAKUTEN_TRAVEL_APPLICATION_ID;
    const latitude = 35.68;
    const longitude = 139.76;

    beforeEach(() => {
        jest.useRealTimers();
        process.env.RAKUTEN_TRAVEL_APPLICATION_ID = 'test-app-id';
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.useRealTimers();
    });

    afterAll(() => {
        global.fetch = originalFetch;
        process.env.RAKUTEN_TRAVEL_APPLICATION_ID = originalAppId;
    });

    it('APIが200を返した場合に宿泊データを返す', async () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2025-01-15T00:00:00Z'));

        const apiResponse = {
            hotels: [
                {
                    hotel: [
                        {
                            hotelBasicInfo: {
                                hotelNo: 100,
                                hotelName: 'テスト宿泊施設',
                                address1: '長野県松本市',
                                address2: '美ヶ原高原',
                                latitude: 36.2,
                                longitude: 137.6,
                                hotelMinCharge: 18000,
                                reviewAverage: 4.7,
                                hotelImageUrl: 'https://example.com/hotel.jpg',
                                nearestStation: '松本駅',
                            },
                        },
                        {
                            hotelDetailInfo: {
                                roomCount: 4,
                            },
                        },
                        {
                            hotelRatingInfo: {
                                locationAverage: 4.6,
                            },
                        },
                    ],
                },
            ],
        };

        const response = new Response(JSON.stringify(apiResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
        const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(response);

        const accommodations = await searchHotelsWithAvailability(latitude, longitude);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('searchRadius=30'),
            expect.objectContaining({ method: 'GET' }),
        );
        expect(accommodations).toHaveLength(1);
        const [hotel] = accommodations;
        expect(hotel).toMatchObject({
            id: '100',
            name: 'テスト宿泊施設',
            prefecture: '長野県',
            location: expect.stringContaining('松本市'),
            availableRooms: 4,
            price: 18000,
            lightPollution: '低',
        });
        expect(hotel.newMoonDate).toMatch(/\d{4}年\d+月\d+日/);
        expect(hotel.clearSkyProbability).toBeGreaterThanOrEqual(40);
        expect(hotel.clearSkyProbability).toBeLessThanOrEqual(95);
        expect(hotel.imageUrl).toBe('https://example.com/hotel.jpg');
    });

    it('APIが非200を返し続ける場合は再試行し最終的に例外を投げる', async () => {
        const fetchMock = jest
            .spyOn(global, 'fetch')
            .mockResolvedValue(new Response(JSON.stringify({}), { status: 500 }));

        await expect(searchHotelsWithAvailability(latitude, longitude)).rejects.toThrow(
            'Unexpected status code: 500',
        );
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('APIレスポンスにエラーが含まれる場合は例外を投げる', async () => {
        const apiResponse = {
            error: 'invalid_request',
            error_description: 'parameter error',
        };
        const response = new Response(JSON.stringify(apiResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
        jest.spyOn(global, 'fetch').mockResolvedValue(response);

        await expect(searchHotelsWithAvailability(latitude, longitude)).rejects.toThrow(
            'parameter error',
        );
    });

    it('環境変数が設定されていない場合は例外を投げる', async () => {
        process.env.RAKUTEN_TRAVEL_APPLICATION_ID = '';

        await expect(searchHotelsWithAvailability(latitude, longitude)).rejects.toThrow(
            'RAKUTEN_TRAVEL_APPLICATION_ID is not set',
        );
    });
});
