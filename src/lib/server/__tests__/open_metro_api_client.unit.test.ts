// Mock state used by the jest.mock factories below
const mockedHttpsState: { response?: any; failTimes?: number; callCount?: number } = {};

jest.mock('dns', () => ({
    promises: {
        lookup: (host: string, options?: any) => {
            if (options && options.all) {
                return Promise.resolve([{ address: '127.0.0.1', family: 4 }]);
            }
            return Promise.resolve({ address: '127.0.0.1', family: 4 });
        },
    },
}));

jest.mock('https', () => {
    const { PassThrough } = require('stream');
    return {
        request: (opts: any, cb: any) => {
            mockedHttpsState.callCount = (mockedHttpsState.callCount || 0) + 1;
            const req = new PassThrough();
            req.on = req.addListener.bind(req);
            req.end = () => process.nextTick(() => {
                const call = mockedHttpsState.callCount || 0;
                const fail = mockedHttpsState.failTimes ?? 0;
                if (call <= fail) {
                    req.emit('error', new Error('simulated network error'));
                    return;
                }
                const res = new PassThrough();
                res.push(JSON.stringify(mockedHttpsState.response));
                res.push(null);
                cb(res);
            });
            return req;
        },
    };
});

describe('getDailyWeatherSummary (unit) - mocked https/dns', () => {
    beforeEach(() => {
        jest.resetModules();
        mockedHttpsState.response = undefined;
        mockedHttpsState.failTimes = 0;
        mockedHttpsState.callCount = 0;
    });

    it('指定日の日次予報を取得できる', async () => {
        const targetDate = '2025-08-01';
        const startIso = new Date(`${targetDate}T00:00:00Z`).toISOString();
        const nextIso = new Date(Date.parse(startIso) + 24 * 60 * 60 * 1000).toISOString();
        mockedHttpsState.response = {
            daily: {
                time: [startIso, nextIso],
                weather_code: [3],
                temperature_2m_max: [25],
                temperature_2m_min: [12],
            },
            hourly: {
                time: [
                    `${targetDate}T00:00:00Z`,
                    `${targetDate}T01:00:00Z`,
                    `${targetDate}T02:00:00Z`,
                    `${targetDate}T03:00:00Z`,
                    `${targetDate}T04:00:00Z`,
                    `${targetDate}T05:00:00Z`,
                ],
                weather_code: [0, 1, 2, 3, 45, 2],
                is_day: [0, 0, 0, 0, 1, 1],
                temperature_2m: [20, 19, 18, 17, 16, 15],
            },
            utc_offset_seconds: 0,
            timezone: 'UTC',
        };

        const { getDailyWeatherSummary } = await import('../open_metro_api_client');

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
        mockedHttpsState.response = {
            daily: {},
            hourly: {},
            utc_offset_seconds: 0,
            timezone: 'UTC',
        };
        const { getDailyWeatherSummary } = await import('../open_metro_api_client');
        await expect(getDailyWeatherSummary(35.0, 139.0, '2025-08-01')).rejects.toThrow(
            'Open-Meteo API 応答に weather code が含まれていません',
        );
    });

    it('API呼び出しが失敗した場合に再試行する', async () => {
        const targetDate = '2025-08-01';
        mockedHttpsState.failTimes = 1; // first call fails
        const startIso = new Date(`${targetDate}T00:00:00Z`).toISOString();
        const nextIso = new Date(Date.parse(startIso) + 24 * 60 * 60 * 1000).toISOString();
        mockedHttpsState.response = {
            daily: {
                time: [startIso, nextIso],
                weather_code: [0],
                temperature_2m_max: [20],
                temperature_2m_min: [10],
            },
            hourly: {
                time: [
                    `${targetDate}T00:00:00Z`,
                    `${targetDate}T01:00:00Z`,
                    `${targetDate}T02:00:00Z`,
                    `${targetDate}T03:00:00Z`,
                    `${targetDate}T04:00:00Z`,
                    `${targetDate}T05:00:00Z`,
                ],
                weather_code: [0, 1, 0, 1, 55, 2],
                is_day: [0, 0, 0, 0, 0, 1],
                temperature_2m: [18, 17, 16, 15, 14, 13],
            },
            utc_offset_seconds: 0,
            timezone: 'UTC',
        };

        const { getDailyWeatherSummary } = await import('../open_metro_api_client');

        const summary = await getDailyWeatherSummary(35.0, 139.0, targetDate);

        expect(summary.date).toBe(targetDate);
        expect(summary.weatherCode).toBe(0);
        expect(summary.isClearSky).toBe(true);
    });
});
