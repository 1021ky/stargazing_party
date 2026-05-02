"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Accommodation, AccommodationCard } from "./AccommodationCard";

interface SearchParams {
    year: string;
    month: string;
    day: string;
    prefecture: string;
}

interface SearchResultsProps {
    accommodations: Accommodation[];
    isLoading: boolean;
    searchParams: SearchParams | null;
    errorMessage?: string | null;
    resolvedAddress?: string | null;
    weather?: {
        date: string;
        isClearSky: boolean;
        temperatureMax: number;
        temperatureMin: number;
        timezone: string;
    } | null;
}

export function SearchResults({
    accommodations,
    isLoading,
    searchParams,
    errorMessage,
    resolvedAddress,
    weather,
}: SearchResultsProps) {
    const [sortKey, setSortKey] = useState<"price-asc" | "rating-desc">(
        "price-asc",
    );
    const formatTemperature = (value: number) =>
        Number.isFinite(value) ? `${Math.round(value)}℃` : "---";

    const sortedAccommodations = useMemo(() => {
        const items = [...accommodations];
        if (sortKey === "rating-desc") {
            return items.sort((a, b) => b.rating - a.rating);
        }
        return items.sort((a, b) => a.price - b.price);
    }, [accommodations, sortKey]);

    if (!searchParams) {
        return (
            <section className="h-full p-4 sm:p-5">
                <div className="flex h-full items-center justify-center rounded-3xl border bg-white px-6 py-12 text-center shadow-sm">
                    <div>
                        <Search className="mx-auto h-12 w-12 text-slate-400" />
                        <h3 className="mt-4 text-lg font-semibold">
                            星空観察に適した宿を検索してください
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">
                            地図の表示エリアと日付を指定して、星空を楽しめる宿泊施設を見つけましょう。
                        </p>
                    </div>
                </div>
            </section>
        );
    }

    if (isLoading) {
        return (
            <section className="p-4 sm:p-5">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {["skeleton-1", "skeleton-2", "skeleton-3", "skeleton-4", "skeleton-5", "skeleton-6"].map((key) => (
                        <div key={key} className="overflow-hidden rounded-2xl border bg-white">
                            <div className="aspect-video animate-pulse bg-slate-200" />
                            <div className="space-y-3 px-6 py-5">
                                <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                                <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-200" />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        );
    }

    if (errorMessage) {
        return (
            <section className="h-full p-4 sm:p-5">
                <div className="flex h-full items-center justify-center rounded-3xl border bg-white px-6 py-12 text-center shadow-sm">
                    <div>
                        <Search className="mx-auto h-12 w-12 text-rose-400" />
                        <h3 className="mt-4 text-lg font-semibold">検索中にエラーが発生しました</h3>
                        <p className="mt-2 text-sm text-rose-500">{errorMessage}</p>
                    </div>
                </div>
            </section>
        );
    }

    if (accommodations.length === 0) {
        return (
            <section className="h-full p-4 sm:p-5">
                <div className="flex h-full items-center justify-center rounded-3xl border bg-white px-6 py-12 text-center shadow-sm">
                    <div>
                        <Search className="mx-auto h-12 w-12 text-slate-400" />
                        <h3 className="mt-4 text-lg font-semibold">
                            該当する宿泊施設が見つかりませんでした
                        </h3>
                        <p className="mt-2 text-sm text-slate-500">
                            {searchParams.year}年{searchParams.month}月{searchParams.day}
                            日に選択エリアで、星空観察に適した宿泊施設は見つかりませんでした。
                        </p>
                        {weather && !weather.isClearSky ? (
                            <p className="mt-4 text-sm text-slate-500">
                                指定日の天気が晴れではないため、表示できる宿泊施設がありません。
                            </p>
                        ) : null}
                        {resolvedAddress ? (
                            <p className="mt-2 text-xs text-slate-400">
                                検索地点: {resolvedAddress}
                            </p>
                        ) : null}
                    </div>
                </div>
            </section>
        );
    }

    return (
        <section className="p-4 sm:p-5">
            <header className="mb-4 space-y-2">
                <div className="flex items-end justify-between gap-3">
                    <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">
                        検索結果
                    </h2>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 sm:text-sm">
                        <span>並び替え</span>
                        <select
                            value={sortKey}
                            onChange={(event) => {
                                const value = event.target.value;
                                if (value === "rating-desc") {
                                    setSortKey("rating-desc");
                                    return;
                                }
                                setSortKey("price-asc");
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 sm:text-sm"
                        >
                            <option value="price-asc">価格が安い順</option>
                            <option value="rating-desc">評価が高い順</option>
                        </select>
                    </label>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                    {searchParams.year}年{searchParams.month}月{searchParams.day}
                    日に選択エリアで見つかった星空観察に適した宿泊施設 ({accommodations.length}
                    件)
                </p>
                {resolvedAddress ? (
                    <p className="text-xs text-slate-400">検索地点: {resolvedAddress}</p>
                ) : null}
                {weather ? (
                    <p className="text-xs text-slate-400">
                        天気: {weather.isClearSky ? "晴れの予報" : "晴れではない予報"} /
                        最高{formatTemperature(weather.temperatureMax)}・最低
                        {formatTemperature(weather.temperatureMin)}
                    </p>
                ) : null}
            </header>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                {sortedAccommodations.map((accommodation) => (
                    <AccommodationCard key={accommodation.id} accommodation={accommodation} />
                ))}
            </div>
        </section>
    );
}
