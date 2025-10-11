import { Search } from "lucide-react";
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
    const formatTemperature = (value: number) => (Number.isFinite(value) ? `${Math.round(value)}℃` : '---');
    if (!searchParams) {
        return (
            <section className="mx-auto mt-10 w-full max-w-4xl">
                <div className="rounded-3xl border bg-white px-6 py-12 text-center shadow-sm">
                    <Search className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-4 text-lg font-semibold">星空観察に適した宿を検索してください</h3>
                    <p className="mt-2 text-sm text-slate-500">
                        年月と都道府県を選択して、新月の夜に星空を楽しめる宿泊施設を見つけましょう。
                    </p>
                </div>
            </section>
        );
    }

    if (isLoading) {
        return (
            <section className="mx-auto mt-10 w-full max-w-6xl">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <div key={index} className="overflow-hidden rounded-2xl border bg-white">
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
            <section className="mx-auto mt-10 w-full max-w-4xl">
                <div className="rounded-3xl border bg-white px-6 py-12 text-center shadow-sm">
                    <Search className="mx-auto h-12 w-12 text-rose-400" />
                    <h3 className="mt-4 text-lg font-semibold">検索中にエラーが発生しました</h3>
                    <p className="mt-2 text-sm text-rose-500">{errorMessage}</p>
                </div>
            </section>
        );
    }

    if (accommodations.length === 0) {
        return (
            <section className="mx-auto mt-10 w-full max-w-4xl">
                <div className="rounded-3xl border bg-white px-6 py-12 text-center shadow-sm">
                    <Search className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-4 text-lg font-semibold">該当する宿泊施設が見つかりませんでした</h3>
                    <p className="mt-2 text-sm text-slate-500">
                        {searchParams.year}年{searchParams.month}月{searchParams.day}日の{searchParams.prefecture}で、星空観察に適した宿泊施設は見つかりませんでした。
                    </p>
                    {weather && !weather.isClearSky ? (
                        <p className="mt-4 text-sm text-slate-500">
                            指定日の天気が晴れではないため、表示できる宿泊施設がありません。
                        </p>
                    ) : null}
                    {resolvedAddress ? (
                        <p className="mt-2 text-xs text-slate-400">検索地点: {resolvedAddress}</p>
                    ) : null}
                </div>
            </section>
        );
    }

    return (
        <section className="mx-auto mt-10 w-full max-w-6xl">
            <header className="mb-6 space-y-2">
                <h2 className="text-xl font-semibold">検索結果</h2>
                <p className="mt-1 text-sm text-slate-500">
                    {searchParams.year}年{searchParams.month}月{searchParams.day}日の{searchParams.prefecture}で見つかった星空観察に適した宿泊施設 ({accommodations.length}件)
                </p>
                {resolvedAddress ? (
                    <p className="text-xs text-slate-400">検索地点: {resolvedAddress}</p>
                ) : null}
                {weather ? (
                    <p className="text-xs text-slate-400">
                        天気: {weather.isClearSky ? '晴れの予報' : '晴れではない予報'} / 最高{formatTemperature(weather.temperatureMax)}・最低{formatTemperature(weather.temperatureMin)}
                    </p>
                ) : null}
            </header>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {accommodations.map((accommodation) => (
                    <AccommodationCard key={accommodation.id} accommodation={accommodation} />
                ))}
            </div>
        </section>
    );
}
