"use client";

import type { FeatureCollection, Geometry } from "geojson";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  loadPrefectureGeoJSON,
  mapDataProviderErrors,
} from "./map_data_provider";

interface PrefectureMapPickerProps {
  value: string;
  onChange: (prefecture: string) => void;
}

type PrefectureProperties = {
  prefecture?: string;
};

type PrefectureFeatureCollection = FeatureCollection<
  Geometry,
  PrefectureProperties
>;

const PrefectureMapCanvas = dynamic(
  () =>
    import("./PrefectureMapCanvas").then(
      (module) => module.PrefectureMapCanvas,
    ),
  {
    ssr: false,
    loading: () => (
      <p className="text-xs text-slate-500">地図を準備しています…</p>
    ),
  },
);

export function PrefectureMapPicker({
  value,
  onChange,
}: PrefectureMapPickerProps) {
  const [geojson, setGeojson] = useState<PrefectureFeatureCollection | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const data = await loadPrefectureGeoJSON();
        if (!mounted) {
          return;
        }
        setGeojson(data);
        setErrorMessage(null);
      } catch {
        if (!mounted) {
          return;
        }
        setGeojson(null);
        setErrorMessage(mapDataProviderErrors.LOAD_ERROR_MESSAGE);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (errorMessage) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-900">
        <p className="rounded-lg bg-white/90 px-3 py-2 text-xs text-rose-500">
          {errorMessage}
        </p>
      </div>
    );
  }

  if (!geojson) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-900">
        <p className="rounded-lg bg-white/90 px-3 py-2 text-xs text-slate-500">
          地図データを読み込み中です…
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <PrefectureMapCanvas geojson={geojson} onPick={onChange} />
      <p className="sr-only">選択中: {value || "未選択"}</p>
    </div>
  );
}
