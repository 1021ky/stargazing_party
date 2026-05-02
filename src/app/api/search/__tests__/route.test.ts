/// <reference types="jest" />

const searchStargazingAccommodationsMock = jest.fn();

jest.mock("@/lib/server/accommodation_search_service", () => ({
    searchStargazingAccommodations: (...args: unknown[]) =>
        searchStargazingAccommodationsMock(...args),
}));

describe("POST /api/search", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it("prefecture 指定で検索できる", async () => {
        searchStargazingAccommodationsMock.mockResolvedValue({
            accommodations: [
                {
                    id: "hotel-1",
                    name: "テストホテル",
                    location: "千代田区",
                    prefecture: "東京都",
                    newMoonDate: "2026年4月8日",
                    clearSkyProbability: 88,
                    price: 18000,
                    rating: 4.6,
                    availableRooms: 2,
                    imageUrl: "https://example.com/hotel.jpg",
                    altitude: 45,
                    bookingUrl: "https://example.com/booking",
                    lightPollutionProxy: 22.5,
                    lightPollutionLevel: "低",
                    lightPollutionSource: "black-marble-vnp46a4",
                },
            ],
            resolvedAddress: "東京都千代田区",
            latitude: 35.68,
            longitude: 139.76,
            weather: {
                date: "2026-04-08",
                isClearSky: true,
                weatherCode: 0,
                temperatureMax: 15,
                temperatureMin: 6,
                timezone: "Asia/Tokyo",
            },
        });

        const { POST } = await import("../route");

        const response = await POST(
            new Request("http://localhost/api/search", {
                method: "POST",
                body: JSON.stringify({
                    date: "2026-04-08",
                    prefecture: "東京都",
                }),
            }),
        );

        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload.accommodations[0]).toMatchObject({
            lightPollutionProxy: 22.5,
            lightPollutionLevel: "低",
            lightPollutionSource: "black-marble-vnp46a4",
        });
        expect(searchStargazingAccommodationsMock).toHaveBeenCalledWith({
            date: "2026-04-08",
            prefecture: "東京都",
            bounds: undefined,
            filters: undefined,
        });
    });

    it("bounds と filters 指定で検索できる", async () => {
        searchStargazingAccommodationsMock.mockResolvedValue({
            accommodations: [],
            resolvedAddress: "東京都新宿区",
            latitude: 35.69,
            longitude: 139.7,
            weather: {
                date: "2026-04-08",
                isClearSky: true,
                weatherCode: 0,
                temperatureMax: 15,
                temperatureMin: 6,
                timezone: "Asia/Tokyo",
            },
        });

        const { POST } = await import("../route");

        const response = await POST(
            new Request("http://localhost/api/search", {
                method: "POST",
                body: JSON.stringify({
                    date: "2026-04-08",
                    bounds: {
                        minLatitude: 35.6,
                        maxLatitude: 35.8,
                        minLongitude: 139.6,
                        maxLongitude: 139.8,
                    },
                    filters: {
                        maxPrice: 20000,
                        minRating: 4.0,
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(searchStargazingAccommodationsMock).toHaveBeenCalledWith({
            date: "2026-04-08",
            prefecture: undefined,
            bounds: {
                minLatitude: 35.6,
                maxLatitude: 35.8,
                minLongitude: 139.6,
                maxLongitude: 139.8,
            },
            filters: {
                maxPrice: 20000,
                minRating: 4.0,
            },
        });
    });

    it("date 未指定は 400 を返す", async () => {
        const { POST } = await import("../route");

        const response = await POST(
            new Request("http://localhost/api/search", {
                method: "POST",
                body: JSON.stringify({ prefecture: "東京都" }),
            }),
        );

        const payload = await response.json();
        expect(response.status).toBe(400);
        expect(payload).toEqual({ message: "date is required" });
    });

    it("prefecture と bounds 同時指定は 400 を返す", async () => {
        const { POST } = await import("../route");

        const response = await POST(
            new Request("http://localhost/api/search", {
                method: "POST",
                body: JSON.stringify({
                    date: "2026-04-08",
                    prefecture: "東京都",
                    bounds: {
                        minLatitude: 35.6,
                        maxLatitude: 35.8,
                        minLongitude: 139.6,
                        maxLongitude: 139.8,
                    },
                }),
            }),
        );

        const payload = await response.json();
        expect(response.status).toBe(400);
        expect(payload).toEqual({
            message: "prefecture and bounds are mutually exclusive",
        });
    });

    it("bounds の範囲が不正な場合は 400 を返す", async () => {
        const { POST } = await import("../route");

        const response = await POST(
            new Request("http://localhost/api/search", {
                method: "POST",
                body: JSON.stringify({
                    date: "2026-04-08",
                    bounds: {
                        minLatitude: 35.8,
                        maxLatitude: 35.8,
                        minLongitude: 139.6,
                        maxLongitude: 139.8,
                    },
                }),
            }),
        );

        const payload = await response.json();
        expect(response.status).toBe(400);
        expect(payload).toEqual({
            message: "bounds.minLatitude must be less than bounds.maxLatitude",
        });
    });

    it("未対応 prefecture は 400 を返す", async () => {
        searchStargazingAccommodationsMock.mockRejectedValueOnce(
            new Error("Unsupported prefecture: 架空県"),
        );
        const { POST } = await import("../route");

        const response = await POST(
            new Request("http://localhost/api/search", {
                method: "POST",
                body: JSON.stringify({
                    date: "2026-04-08",
                    prefecture: "架空県",
                }),
            }),
        );

        const payload = await response.json();
        expect(response.status).toBe(400);
        expect(payload).toEqual({ message: "Unsupported prefecture: 架空県" });
    });

    it("予期しない障害は 500 を返す", async () => {
        searchStargazingAccommodationsMock.mockRejectedValueOnce(
            new Error("upstream timeout"),
        );
        const { POST } = await import("../route");

        const response = await POST(
            new Request("http://localhost/api/search", {
                method: "POST",
                body: JSON.stringify({
                    date: "2026-04-08",
                    prefecture: "東京都",
                }),
            }),
        );

        const payload = await response.json();
        expect(response.status).toBe(500);
        expect(payload).toEqual({ message: "Internal server error" });
    });
});
