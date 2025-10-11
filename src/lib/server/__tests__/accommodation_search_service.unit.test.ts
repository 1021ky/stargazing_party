import { searchStargazingAccommodations } from '../accommodation_search_service';

jest.mock('../prefecture_geocode', () => ({
    getPrefectureCoordinates: jest.fn(),
}));

jest.mock('../yahoo_reverse_geocoder_api_client', () => ({
    getYahooReverseGeocodedAddress: jest.fn(),
}));

jest.mock('../open_metro_api_client', () => ({
    getDailyWeatherSummary: jest.fn(),
}));

jest.mock('../rakuten_travel_hotel_search_api_client', () => ({
    searchHotelsWithAvailability: jest.fn(),
}));

describe('searchStargazingAccommodations', () => {
    const { getPrefectureCoordinates } = jest.requireMock('../prefecture_geocode');
    const { getYahooReverseGeocodedAddress } = jest.requireMock('../yahoo_reverse_geocoder_api_client');
    const { getDailyWeatherSummary } = jest.requireMock('../open_metro_api_client');
    const { searchHotelsWithAvailability } = jest.requireMock('../rakuten_travel_hotel_search_api_client');

    beforeEach(() => {
        jest.resetAllMocks();
        getPrefectureCoordinates.mockReturnValue({ latitude: 35.68944, longitude: 139.69167 });
        getYahooReverseGeocodedAddress.mockResolvedValue('東京都千代田区千代田1-1');
        getDailyWeatherSummary.mockResolvedValue({
            date: '2025-02-01',
            isClearSky: true,
            weatherCode: 0,
            temperatureMax: 10,
            temperatureMin: 2,
            timezone: 'Asia/Tokyo',
        });
        searchHotelsWithAvailability.mockResolvedValue([
            {
                id: '1',
                name: 'ホテルA',
                location: '千代田区',
                prefecture: '東京都',
                newMoonDate: '2025年2月1日',
                clearSkyProbability: 85,
                price: 18000,
                rating: 4.5,
                availableRooms: 2,
                imageUrl: 'https://example.com/a.jpg',
                lightPollution: '低',
                altitude: 50,
            },
            {
                id: '2',
                name: 'ホテルB',
                location: '中央区',
                prefecture: '東京都',
                newMoonDate: '2025年2月1日',
                clearSkyProbability: 60,
                price: 15000,
                rating: 4.2,
                availableRooms: 0,
                imageUrl: 'https://example.com/b.jpg',
                lightPollution: '中',
                altitude: 40,
            },
        ]);
    });

    it('天気が晴れの場合に、空き室があるホテルを返す', async () => {
        const result = await searchStargazingAccommodations({ date: '2025-02-01', prefecture: '東京都' });

        expect(result.accommodations).toHaveLength(1);
        expect(result.accommodations[0]).toMatchObject({ id: '1', name: 'ホテルA' });
        expect(result.resolvedAddress).toBe('東京都千代田区千代田1-1');
        expect(getPrefectureCoordinates).toHaveBeenCalledWith('東京都');
        expect(getYahooReverseGeocodedAddress).toHaveBeenCalledWith(35.68944, 139.69167);
        expect(getDailyWeatherSummary).toHaveBeenCalledWith(35.68944, 139.69167, '2025-02-01');
        expect(searchHotelsWithAvailability).toHaveBeenCalledWith(35.68944, 139.69167, ['2025-02-01']);
    });

    it('天気が晴れでない場合は空配列を返す', async () => {
        getDailyWeatherSummary.mockResolvedValueOnce({
            date: '2025-02-01',
            isClearSky: false,
            weatherCode: 3,
            temperatureMax: 8,
            temperatureMin: 1,
            timezone: 'Asia/Tokyo',
        });

        const result = await searchStargazingAccommodations({ date: '2025-02-01', prefecture: '東京都' });

        expect(result.accommodations).toHaveLength(0);
    });

    it('都道府県がサポート対象外の場合は例外を投げる', async () => {
        getPrefectureCoordinates.mockReturnValueOnce(null);

        await expect(
            searchStargazingAccommodations({ date: '2025-02-01', prefecture: '架空県' }),
        ).rejects.toThrow('Unsupported prefecture: 架空県');
    });

    it('日付が不正な場合は例外を投げる', async () => {
        await expect(
            searchStargazingAccommodations({ date: 'invalid-date', prefecture: '東京都' }),
        ).rejects.toThrow('date must be a valid ISO 8601 string (YYYY-MM-DD)');
    });
});
