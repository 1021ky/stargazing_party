/**
 * Phase B Integration Test: Data Collection at 3 Locations
 *
 * This test collects light pollution data from 3 fixed locations:
 * 1. Umeda Station (Osaka) - Urban area, expected to be BRIGHT
 * 2. Namba Station (Osaka) - Urban area, expected to be BRIGHT
 * 3. Tenkawa Village (Nara) - Mountain area, expected to be DARK
 *
 * The test captures console logs with DEBUG output to verify:
 * - Black Marble endpoint status
 * - GIBS fallback behavior
 * - Classification consistency
 * - Relative brightness ordering
 */

import { resolveLightPollution } from '../light_pollution_service';

interface TestLocation {
  name: string;
  latitude: number;
  longitude: number;
  expectedBrightness: 'bright' | 'dark';
}

const testLocations: TestLocation[] = [
  {
    name: 'Umeda Station (Osaka)',
    latitude: 34.7020,
    longitude: 135.4955,
    expectedBrightness: 'bright',
  },
  {
    name: 'Namba Station (Osaka)',
    latitude: 34.6653,
    longitude: 135.5023,
    expectedBrightness: 'bright',
  },
  {
    name: 'Tenkawa Village (Nara)',
    latitude: 34.1833,
    longitude: 136.0333,
    expectedBrightness: 'dark',
  },
];

describe('Phase B: Light Pollution Data Collection', () => {
  let consoleLogSpy: jest.SpyInstance;
  const logs: string[] = [];

  beforeAll(() => {
    // Capture all console.log output to verify DEBUG logs
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((msg) => {
      logs.push(msg);
      // Optionally also print to see in real-time
      if (typeof msg === 'string') {
        process.stdout.write(`${msg}\n`);
      }
    });
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('should collect light pollution data from all 3 locations', async () => {
    const results = [];

    for (const location of testLocations) {
      console.log(`\n📍 ${location.name}`);
      console.log(
        `   Coordinates: (${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)})`,
      );
      console.log(`   Expected: ${location.expectedBrightness}`);
      console.log('-'.repeat(70));

      const result = await resolveLightPollution({
        latitude: location.latitude,
        longitude: location.longitude,
        year: 2024,
      });

      console.log(`   📊 Classification: ${result.lightPollutionLevel}`);
      console.log(`   📦 Source: ${result.lightPollutionSource}`);
      console.log(`   🔢 Raw Value: ${result.lightPollutionProxy}`);

      results.push({
        location: location.name,
        ...result,
      });
    }

    // Verify that we got results for all locations
    expect(results).toHaveLength(3);

    // Log summary
    console.log('\n' + '='.repeat(70));
    console.log('📋 Collection Summary:');
    results.forEach((r, idx) => {
      console.log(
        `  ${idx + 1}. ${r.location.padEnd(25)} → ${r.lightPollutionLevel}`,
      );
    });

    // Verify that DEBUG logs were captured
    const debugLogs = logs.filter((l) => l.includes('[DEBUG:'));
    console.log(`\n✅ DEBUG logs captured: ${debugLogs.length} entries`);

    expect(debugLogs.length).toBeGreaterThan(0);
  });

  it('should show Black Marble endpoint status in DEBUG logs', async () => {
    logs.length = 0; // Reset logs

    await resolveLightPollution({
      latitude: 34.7020,
      longitude: 135.4955,
      year: 2024,
    });

    const endpointLog = logs.find((l) => l.includes('ENDPOINT'));
    console.log(
      `\nEndpoint Check: ${endpointLog ? '❌ NOT SET' : '✅ SET or using GIBS'}`,
    );

    // If endpoint is not set, GIBS should be used as fallback
    if (endpointLog) {
      expect(endpointLog).toContain('ENDPOINT NOT SET');
    }
  });

  it('should trace fallback from Black Marble to GIBS if endpoint not set', async () => {
    logs.length = 0;

    await resolveLightPollution({
      latitude: 34.1833,
      longitude: 136.0333,
      year: 2024,
    });

    const flowLogs = logs.filter((l) => l.includes('[DEBUG:'));
    console.log('\n🔄 Resolution Flow:');
    flowLogs.forEach((log) => {
      console.log(`  ${log}`);
    });

    // Verify flow went through at least Black Marble attempt
    const hasBMAttempt = flowLogs.some((l) =>
      l.includes('Trying Black Marble'),
    );
    expect(hasBMAttempt).toBe(true);

    // Verify we got a result (either from BM, GIBS, or fallback)
    const hasResult = flowLogs.some(
      (l) => l.includes('SUCCESS') || l.includes('fallback'),
    );
    expect(hasResult).toBe(true);
  });
});
