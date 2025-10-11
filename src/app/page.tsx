"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { Accommodation } from "./_components/AccommodationCard";
import { SearchForm } from "./_components/SearchForm";
import { SearchResults } from "./_components/SearchResults";

type SearchParams = {
  year: string;
  month: string;
  day: string;
  prefecture: string;
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
  const [searchMetadata, setSearchMetadata] = useState<SearchMetadata | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSearch = async (year: string, month: string, day: string, prefecture: string) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setIsLoading(true);
    setErrorMessage(null);
    setAccommodations([]);
    setSearchMetadata(null);
    setSearchParams({ year, month, day, prefecture });

    let dateIso: string;
    try {
      dateIso = buildIsoDate(year, month, day);
    } catch (error) {
      const message = error instanceof Error ? error.message : '日付の解釈に失敗しました';
      setErrorMessage(message);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ date: dateIso, prefecture }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = typeof payload?.message === 'string' ? payload.message : '検索に失敗しました';
        throw new Error(message);
      }

      const data = await response.json();
      const hotels = Array.isArray(data?.accommodations) ? data.accommodations : [];
      const resolvedAddress = typeof data?.resolvedAddress === 'string' ? data.resolvedAddress : null;
      const weather = data?.weather && typeof data.weather === 'object' ? {
        date: typeof data.weather.date === 'string' ? data.weather.date : '',
        isClearSky: Boolean(data.weather.isClearSky),
        temperatureMax: Number(data.weather.temperatureMax ?? Number.NaN),
        temperatureMin: Number(data.weather.temperatureMin ?? Number.NaN),
        timezone: typeof data.weather.timezone === 'string' ? data.weather.timezone : '',
      } : null;
      setAccommodations(hotels);
      setSearchMetadata({ resolvedAddress, weather });
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      const message = error instanceof Error ? error.message : '予期しないエラーが発生しました';
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <header className="mx-auto max-w-3xl text-center">
        <div className="flex items-center justify-center gap-3 text-sky-500">
          <Star className="h-8 w-8 fill-sky-400" />
          <h1 className="text-3xl font-bold text-slate-800 sm:text-4xl">星空宿泊検索</h1>
          <Star className="h-8 w-8 fill-sky-400" />
        </div>
        <p className="mt-4 text-sm text-slate-600 sm:text-base">
          選択した地域で星が見やすい日に宿泊できる施設を検索します。星を見る会を開きましょう！
        </p>
      </header>

      <main className="mx-auto mt-10 flex w-full max-w-6xl flex-col gap-10">
        <SearchForm onSearch={handleSearch} />
        <SearchResults
          accommodations={accommodations}
          isLoading={isLoading}
          searchParams={searchParams}
          errorMessage={errorMessage}
          resolvedAddress={searchMetadata?.resolvedAddress ?? null}
          weather={searchMetadata?.weather ?? null}
        />
      </main>
    </div>
  );
}

function buildIsoDate(year: string, month: string, day: string): string {
  const yearNum = Number.parseInt(year, 10);
  const monthNum = Number.parseInt(month, 10);
  const dayNum = Number.parseInt(day, 10);

  if (Number.isNaN(yearNum) || Number.isNaN(monthNum) || Number.isNaN(dayNum)) {
    throw new Error('日付の指定が不正です');
  }

  const iso = `${yearNum.toString().padStart(4, '0')}-${monthNum.toString().padStart(2, '0')}-${dayNum
    .toString()
    .padStart(2, '0')}`;

  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('存在しない日付が指定されました');
  }

  return iso;
}
