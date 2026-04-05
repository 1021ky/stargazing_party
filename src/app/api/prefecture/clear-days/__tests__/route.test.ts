/// <reference types="jest" />

const getDailyWeatherSummariesRangeMock = jest.fn();
const getPrefectureCoordinatesMock = jest.fn();

jest.mock('@/lib/server/open_metro_api_client', () => ({
    getDailyWeatherSummariesRange: (...args: unknown[]) => getDailyWeatherSummariesRangeMock(...args),
}));

jest.mock('@/lib/server/prefecture_geocode', () => ({
    getPrefectureCoordinates: (...args: unknown[]) => getPrefectureCoordinatesMock(...args),
}));

describe('GET /api/prefecture/clear-days', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        jest.useFakeTimers();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        jest.useRealTimers();
        process.env = originalEnv;
    });

    it('today が許容上限を超える場合は 200 + days:[] を返し、外部APIを呼ばない', async () => {
        jest.setSystemTime(new Date('2026-04-04T00:00:00.000Z'));

        process.env.OPEN_METEO_ALLOWED_START_DATE_MIN = '2025-07-10';
        process.env.OPEN_METEO_ALLOWED_START_DATE_MAX = '2025-10-26';

        getPrefectureCoordinatesMock.mockReturnValue({ latitude: 34.6913, longitude: 135.1830 });

        const { GET } = await import('../route');

        const request = new Request('http://localhost/api/prefecture/clear-days?prefecture=%E5%85%B5%E5%BA%AB%E7%9C%8C');
        const response = await GET(request);
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload).toEqual({
            prefecture: '兵庫県',
            startDate: null,
            endDate: null,
            days: [],
            availability: 'out_of_supported_range',
            message: '現在の提供期間外のため晴れ予報を表示できません。',
        });
        expect(getDailyWeatherSummariesRangeMock).not.toHaveBeenCalled();
    });
});
