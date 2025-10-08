import { getDailyWeatherSummary } from '../open_metro_api_client';
import { fetchWeatherApi } from 'openmeteo';

jest.mock('openmeteo', () => ({
    fetchWeatherApi: jest.fn(),
}));

const mockedFetchWeatherApi = fetchWeatherApi as jest.MockedFunction<typeof fetchWeatherApi>;

describe('getDailyWeatherSummary (unit)', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('指定日の日次予報を取得できる', async () => {
        const targetDate = '2025-01-01';
        const startTimestamp = Date.parse(`${targetDate}T00:00:00Z`) / 1000;
        const intervalSeconds = 86_400;

        const daily = createDailyMock(startTimestamp, intervalSeconds, [
            Float32Array.from([3]),
            Float32Array.from([25]),
            Float32Array.from([12]),
        ]);
        const response = createResponseMock(daily, 0, 'UTC');

        mockedFetchWeatherApi.mockResolvedValue([response]);

        const summary = await getDailyWeatherSummary(35.0, 139.0, targetDate);

        expect(summary).toEqual({
            date: targetDate,
            weatherCode: 3,
            temperatureMax: 25,
            temperatureMin: 12,
            timezone: 'UTC',
            isClearSky: false,
        });
    });

    it('日次データが含まれない場合にエラーを投げる', async () => {
        const response = {
            daily: () => null,
            utcOffsetSeconds: () => 0,
            timezone: () => 'UTC',
        } as unknown as Awaited<ReturnType<typeof fetchWeatherApi>>[number];

        mockedFetchWeatherApi.mockResolvedValue([response]);

        await expect(getDailyWeatherSummary(35.0, 139.0, '2025-01-01')).rejects.toThrow(
            'Open-Meteo API の応答に日次データが含まれていません',
        );
    });

    it('不正な緯度が渡された場合にエラーになる', async () => {
        await expect(getDailyWeatherSummary(Number.NaN, 139.0, '2025-01-01')).rejects.toThrow(TypeError);
    });
});

function createDailyMock(
    startTimestamp: number,
    intervalSeconds: number,
    variables: Float32Array[],
): NonNullable<ReturnType<Awaited<ReturnType<typeof fetchWeatherApi>>[number]['daily']>> {
    return {
        time: () => BigInt(startTimestamp),
        timeEnd: () => BigInt(startTimestamp + intervalSeconds * variables[0].length),
        interval: () => intervalSeconds,
        variables: (index: number) => {
            const values = variables[index];
            if (!values) {
                return null;
            }
            return {
                valuesArray: () => values,
            };
        },
    } as unknown as NonNullable<ReturnType<Awaited<ReturnType<typeof fetchWeatherApi>>[number]['daily']>>;
}

function createResponseMock(
    daily: NonNullable<ReturnType<Awaited<ReturnType<typeof fetchWeatherApi>>[number]['daily']>>,
    utcOffsetSeconds: number,
    timezone: string,
): Awaited<ReturnType<typeof fetchWeatherApi>>[number] {
    return {
        daily: () => daily,
        utcOffsetSeconds: () => utcOffsetSeconds,
        timezone: () => timezone,
    } as unknown as Awaited<ReturnType<typeof fetchWeatherApi>>[number];
}
