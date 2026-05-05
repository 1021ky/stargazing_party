import "@testing-library/jest-dom";

/**
 * Mock Black Marble API responses for testing
 * Simulates realistic light pollution data for known locations
 */
global.fetch = jest
  .fn()
  .mockImplementation((url: string | URL) => {
    const urlString = url.toString();

    // Mock Black Marble endpoint responses
    if (
      urlString.includes("localhost:9999") ||
      urlString.includes("black-marble-mock")
    ) {
      const urlObj = new URL(urlString);
      const lat = parseFloat(urlObj.searchParams.get("latitude") || "0");
      const lon = parseFloat(urlObj.searchParams.get("longitude") || "0");

      // Simulate realistic NTL (Night-time Lights) proxy values
      // Urban areas (Osaka): high brightness ~150-200
      // Rural/Mountain (Nara): low brightness ~20-50
      let proxyRaw = 50; // Default value

      // Urban areas (Osaka)
      if (lat > 34.6 && lat < 34.8 && lon > 135.4 && lon < 135.6) {
        proxyRaw = 165; // Bright urban area
      }
      // Mountain area (Tenkawa, Nara)
      else if (lat > 34.1 && lat < 34.2 && lon > 136.0 && lon < 136.1) {
        proxyRaw = 25; // Dark mountain area
      }

      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            proxyRaw,
            qualityFlag: 2, // gap-filled
            value: proxyRaw,
            quality: 2,
          }),
      });
    }

    // Default: delegate to real fetch
    return Promise.reject(
      new Error(`Unexpected fetch call: ${urlString}`),
    );
  }) as jest.Mock;

