/** @jest-environment jsdom */

import { render, screen } from "@testing-library/react";
import { AccommodationCard } from "../AccommodationCard";

jest.mock("lucide-react", () => ({
  Calendar: () => <span data-testid="icon-calendar" />,
  Cloud: () => <span data-testid="icon-cloud" />,
  MapPin: () => <span data-testid="icon-map-pin" />,
  Star: () => <span data-testid="icon-star" />,
}));

describe("AccommodationCard", () => {
  it("光害レベルと source 情報を表示する", () => {
    render(
      <AccommodationCard
        accommodation={{
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
          lightPollutionDataLabel: "2024年データ",
        }}
      />,
    );

    expect(screen.getByText("光害: 低")).toBeInTheDocument();
    expect(screen.getByText("NTL 22.5 (direct)")).toBeInTheDocument();
    expect(screen.getByText("2024年データ")).toBeInTheDocument();
  });

  it("gibs-black-marble の場合は (satellite) ラベルを表示する", () => {
    render(
      <AccommodationCard
        accommodation={{
          id: "hotel-3",
          name: "テストホテル3",
          location: "長野県",
          prefecture: "長野県",
          newMoonDate: "2026年4月8日",
          clearSkyProbability: 90,
          price: 12000,
          rating: 4.5,
          availableRooms: 3,
          imageUrl: "https://example.com/hotel3.jpg",
          altitude: 800,
          bookingUrl: "https://example.com/booking3",
          lightPollutionProxy: 15.0,
          lightPollutionLevel: "低",
          lightPollutionSource: "gibs-black-marble",
          lightPollutionDataLabel: "2024年データ",
        }}
      />,
    );

    expect(screen.getByText("光害: 低")).toBeInTheDocument();
    expect(screen.getByText("NTL 15.0 (satellite)")).toBeInTheDocument();
  });

  it("fallback の場合は不明を表示する", () => {
    render(
      <AccommodationCard
        accommodation={{
          id: "hotel-2",
          name: "テストホテル2",
          location: "港区",
          prefecture: "東京都",
          newMoonDate: "2026年4月8日",
          clearSkyProbability: 70,
          price: 22000,
          rating: 4.2,
          availableRooms: 1,
          imageUrl: "https://example.com/hotel2.jpg",
          altitude: 30,
          bookingUrl: "https://example.com/booking2",
          lightPollutionProxy: null,
          lightPollutionLevel: "不明",
          lightPollutionSource: "fallback",
          lightPollutionDataLabel: "2024年データ",
        }}
      />,
    );

    expect(screen.getByText("光害: 不明")).toBeInTheDocument();
    expect(screen.getByText("NTL -- (fallback)")).toBeInTheDocument();
  });
});
