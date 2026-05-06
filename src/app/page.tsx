"use client";

import { useEffect, useRef, useState } from "react";
import type { Accommodation } from "./_components/AccommodationCard";
import type { MapSearchBounds } from "./_components/PrefectureMapCanvas";
import { SearchForm } from "./_components/SearchForm";
import { SearchResults } from "./_components/SearchResults";

type SearchFilters = {
  maxPrice?: number;
  minRating?: number;
};

type SearchParams = {
  year: string;
  month: string;
  day: string;
  prefecture: string;
  bounds?: MapSearchBounds;
  filters?: SearchFilters;
} | null;

type SearchMetadata = {
  resolvedAddress: string | null;
  weather: {
    date: string;
    isClearSky: boolean;
    temperatureMax: number;
    temperatureMin: number;
    timezone: string;
  } | null;
};

export default function Home() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams, setSearchParams] = useState<SearchParams>(null);
  const [searchMetadata, setSearchMetadata] = useState<SearchMetadata | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSearch = async (
    year: string,
    month: string,
    day: string,
    prefecture: string,
    options: {
      bounds?: MapSearchBounds;
      filters?: SearchFilters;
    },
  ) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsLoading(true);
    setErrorMessage(null);
    setAccommodations([]);
    setSearchMetadata(null);
    setSearchParams({
      year,
      month,
      day,
      prefecture,
      bounds: options.bounds,
      filters: options.filters,
    });

    let dateIso: string;
    try {
      dateIso = buildIsoDate(year, month, day);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "日付の解釈に失敗しました";
      setErrorMessage(message);
      setIsLoading(false);
      return;
    }

    const requestParams = new URLSearchParams({ date: dateIso });

    if (options.bounds) {
      requestParams.set("bounds", JSON.stringify(options.bounds));
    } else {
      requestParams.set("prefecture", prefecture);
    }

    if (options.filters) {
      requestParams.set("filters", JSON.stringify(options.filters));
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch(`/api/search?${requestParams.toString()}`, {
        method: "GET",
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message =
          typeof payload?.message === "string"
            ? payload.message
            : "検索に失敗しました";
        throw new Error(message);
      }

      const data = await response.json();
      const hotels = Array.isArray(data?.accommodations)
        ? data.accommodations
        : [];
      const resolvedAddress =
        typeof data?.resolvedAddress === "string" ? data.resolvedAddress : null;
      const weather =
        data?.weather && typeof data.weather === "object"
          ? {
              date:
                typeof data.weather.date === "string" ? data.weather.date : "",
              isClearSky: Boolean(data.weather.isClearSky),
              temperatureMax: Number(data.weather.temperatureMax ?? Number.NaN),
              temperatureMin: Number(data.weather.temperatureMin ?? Number.NaN),
              timezone:
                typeof data.weather.timezone === "string"
                  ? data.weather.timezone
                  : "",
            }
          : null;
      setAccommodations(hotels);
      setSearchMetadata({ resolvedAddress, weather });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message =
        error instanceof Error
          ? error.message
          : "予期しないエラーが発生しました";
      setErrorMessage(message);
      setAccommodations([]);
      setSearchMetadata(null);
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-100">
      <main className="grid h-full grid-rows-[54dvh_46dvh] lg:grid-cols-2 lg:grid-rows-1">
        <div className="min-h-0">
          <SearchForm onSearch={handleSearch} />
        </div>
        <div className="min-h-0 overflow-y-auto border-t border-slate-200 bg-slate-50 lg:border-l lg:border-t-0">
          <SearchResults
            accommodations={accommodations}
            isLoading={isLoading}
            searchParams={searchParams}
            errorMessage={errorMessage}
            resolvedAddress={searchMetadata?.resolvedAddress ?? null}
            weather={searchMetadata?.weather ?? null}
          />
        </div>
      </main>
    </div>
  );
}

function buildIsoDate(year: string, month: string, day: string): string {
  const yearNum = Number.parseInt(year, 10);
  const monthNum = Number.parseInt(month, 10);
  const dayNum = Number.parseInt(day, 10);

  if (Number.isNaN(yearNum) || Number.isNaN(monthNum) || Number.isNaN(dayNum)) {
    throw new Error("日付の指定が不正です");
  }

  const iso = `${yearNum.toString().padStart(4, "0")}-${monthNum.toString().padStart(2, "0")}-${dayNum
    .toString()
    .padStart(2, "0")}`;

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("存在しない日付が指定されました");
  }

  return iso;
}
