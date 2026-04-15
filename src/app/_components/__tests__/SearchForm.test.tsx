/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchForm } from "../SearchForm";

jest.mock("react-day-picker", () => ({
  DayPicker: ({ onSelect }: { onSelect: (day: Date) => void }) => (
    <button
      type="button"
      onClick={() => onSelect(new Date(2026, 3, 8))}
      aria-label="2026-04-08"
    >
      2026-04-08を選択
    </button>
  ),
}));

jest.mock("../PrefectureMapPicker", () => ({
  PrefectureMapPicker: ({
    onChange,
    onBoundsChange,
  }: {
    onChange: (prefecture: string) => void;
    onBoundsChange?: (bounds: {
      minLatitude: number;
      maxLatitude: number;
      minLongitude: number;
      maxLongitude: number;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() => {
        onChange("長野県");
        onBoundsChange?.({
          minLatitude: 36.0,
          maxLatitude: 36.5,
          minLongitude: 138.0,
          maxLongitude: 138.6,
        });
      }}
    >
      地図で長野県を選択
    </button>
  ),
}));

describe("SearchForm", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        startDate: "2026-04-07",
        endDate: "2026-04-21",
        days: [
          {
            date: "2026-04-08",
            isClearSky: true,
            weatherCode: 0,
            temperatureMax: 14,
            temperatureMin: 6,
          },
        ],
      }),
    } as Response);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.resetAllMocks();
  });

  it("地図選択で都道府県が更新され、晴れ予報取得を開始する", async () => {
    const onSearch = jest.fn();
    render(<SearchForm onSearch={onSearch} />);

    const user = userEvent.setup();
    await user.click(screen.getByText("地図で長野県を選択"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/prefecture/clear-days?prefecture=%E9%95%B7%E9%87%8E%E7%9C%8C",
        expect.any(Object),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "表示エリアで宿を検索" }),
      ).toBeEnabled();
    });
  });

  it("都道府県未選択時は検索ボタンが無効になる", async () => {
    const onSearch = jest.fn();
    render(<SearchForm onSearch={onSearch} />);

    const submitButton = screen.getByRole("button", {
      name: "表示エリアで宿を検索",
    });
    expect(submitButton).toBeDisabled();
  });

  it("検索時に bounds と filters を onSearch へ渡す", async () => {
    const onSearch = jest.fn();
    render(<SearchForm onSearch={onSearch} />);

    const user = userEvent.setup();
    await user.click(screen.getByText("地図で長野県を選択"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    await user.click(screen.getByPlaceholderText("晴れの日を選択してください"));
    await user.click(screen.getByRole("button", { name: "2026-04-08" }));

    await user.selectOptions(
      screen.getByRole("combobox", { name: "価格" }),
      "¥20,000以下",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "評価" }),
      "4.0以上",
    );
    await user.click(
      screen.getByRole("button", { name: "表示エリアで宿を検索" }),
    );

    expect(onSearch).toHaveBeenCalledWith("2026", "4", "8", "長野県", {
      bounds: {
        minLatitude: 36,
        maxLatitude: 36.5,
        minLongitude: 138,
        maxLongitude: 138.6,
      },
      filters: {
        maxPrice: 20000,
        minRating: 4,
      },
    });
  });
});
