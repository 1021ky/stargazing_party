import { Search } from "lucide-react";
import { Accommodation, AccommodationCard } from "./AccommodationCard";

interface SearchResultsProps {
    accommodations: Accommodation[];
    isLoading: boolean;
    searchParams: {
        year: string;
        month: string;
        prefecture: string;
    } | null;
}

export function SearchResults({ accommodations, isLoading, searchParams }: SearchResultsProps) {
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

    if (accommodations.length === 0) {
        return (
            <section className="mx-auto mt-10 w-full max-w-4xl">
                <div className="rounded-3xl border bg-white px-6 py-12 text-center shadow-sm">
                    <Search className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-4 text-lg font-semibold">該当する宿泊施設が見つかりませんでした</h3>
                    <p className="mt-2 text-sm text-slate-500">
                        {searchParams.year}年{searchParams.month}月の{searchParams.prefecture}で、星空観察に適した宿泊施設は見つかりませんでした。
                    </p>
                </div>
            </section>
        );
    }

    return (
        <section className="mx-auto mt-10 w-full max-w-6xl">
            <header className="mb-6">
                <h2 className="text-xl font-semibold">検索結果</h2>
                <p className="mt-1 text-sm text-slate-500">
                    {searchParams.year}年{searchParams.month}月の{searchParams.prefecture}で見つかった星空観察に適した宿泊施設 ({accommodations.length}件)
                </p>
            </header>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {accommodations.map((accommodation) => (
                    <AccommodationCard key={accommodation.id} accommodation={accommodation} />
                ))}
            </div>
        </section>
    );
}
