import { getDailyWeatherSummary } from '../open_metro_api_client';

jest.setTimeout(30_000);

const describeOrSkip = process.env.RUN_OPEN_METEO_INTEGRATION ? describe : describe.skip;

describeOrSkip('getDailyWeatherSummary (integration)', () => {

    it('実際のAPIから東京都の天気を取得できる', async () => {
        const today = new Date();
        const targetDate = today.toISOString().slice(0, 10);

        const summary = await getDailyWeatherSummary(35.6762, 139.6503, targetDate);

        expect(summary.date).toBe(targetDate);
        expect(typeof summary.weatherCode).toBe('number');
        expect(Number.isFinite(summary.temperatureMax)).toBe(true);
        expect(Number.isFinite(summary.temperatureMin)).toBe(true);
        expect(summary.timezone.length).toBeGreaterThan(0);
        expect(typeof summary.isClearSky).toBe('boolean');
    });
});
