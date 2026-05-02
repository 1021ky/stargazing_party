/** @jest-environment jsdom */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PrefectureMapPicker } from "../PrefectureMapPicker";

jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    const { PrefectureMapCanvas } = jest.requireMock("../PrefectureMapCanvas");
    return PrefectureMapCanvas;
  },
}));

jest.mock("../map_data_provider", () => ({
  loadPrefectureGeoJSON: jest.fn(),
  mapDataProviderErrors: {
    LOAD_ERROR_MESSAGE: "地図データの読み込みに失敗しました",
  },
}));

jest.mock("../PrefectureMapCanvas", () => ({
  PrefectureMapCanvas: ({
    geojson,
    onPick,
  }: {
    geojson: {
      features: Array<{ properties?: { prefecture?: string } | null }>;
    };
    onPick: (prefecture: string) => void;
  }) => (
    <button
      type="button"
      onClick={() => onPick(geojson.features[0]?.properties?.prefecture ?? "")}
    >
      都道府県を選択
    </button>
  ),
}));

describe("PrefectureMapPicker", () => {
  const { loadPrefectureGeoJSON } = jest.requireMock("../map_data_provider");

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it("地図上の都道府県クリックで prefecture を onChange へ渡す", async () => {
    loadPrefectureGeoJSON.mockResolvedValue({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { prefecture: "長野県" },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [138, 36],
                [138.5, 36],
                [138.5, 36.5],
                [138, 36.5],
                [138, 36],
              ],
            ],
          },
        },
      ],
    });

    const handleChange = jest.fn();
    render(<PrefectureMapPicker value="" onChange={handleChange} />);

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "都道府県を選択" }),
    );

    expect(handleChange).toHaveBeenCalledWith("長野県");
  });

  it("GeoJSON 読み込み失敗時はフォールバックメッセージを表示する", async () => {
    loadPrefectureGeoJSON.mockRejectedValue(
      new Error("地図データの読み込みに失敗しました"),
    );

    render(<PrefectureMapPicker value="" onChange={jest.fn()} />);

    await waitFor(() => {
      expect(
        screen.getByText("地図データの読み込みに失敗しました"),
      ).toBeInTheDocument();
    });
  });
});
