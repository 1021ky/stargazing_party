"use client";

import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { Accommodation } from "./_components/AccommodationCard";
import { SearchForm } from "./_components/SearchForm";
import { SearchResults } from "./_components/SearchResults";

type SearchParams = {
  year: string;
  month: string;
  prefecture: string;
} | null;

const mockAccommodations: Accommodation[] = [
  {
    id: "1",
    name: "星空リゾート 八ヶ岳高原ホテル",
    location: "八ヶ岳高原",
    prefecture: "長野県",
    newMoonDate: "2025年11月1日",
    clearSkyProbability: 85,
    price: 18000,
    rating: 4.8,
    availableRooms: 3,
    imageUrl: "https://images.unsplash.com/photo-1568556612080-6353ba48eb8a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMGhvdGVsJTIwbmlnaHQlMjBzdGFyc3xlbnwxfHx8fDE3NTk5MTIzMTV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    lightPollution: "低",
    altitude: 1400,
  },
  {
    id: "2",
    name: "天の川温泉旅館",
    location: "美ヶ原高原",
    prefecture: "長野県",
    newMoonDate: "2025年11月1日",
    clearSkyProbability: 78,
    price: 12000,
    rating: 4.5,
    availableRooms: 5,
    imageUrl: "https://images.unsplash.com/photo-1733653023417-92ffcab24969?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx0cmFkaXRpb25hbCUyMGphcGFuZXNlJTIwcnlva2FufGVufDF8fHx8MTc1OTkwODYzNHww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    lightPollution: "低",
    altitude: 1200,
  },
  {
    id: "3",
    name: "高原山荘 星見の宿",
    location: "乗鞍高原",
    prefecture: "長野県",
    newMoonDate: "2025年11月1日",
    clearSkyProbability: 82,
    price: 15000,
    rating: 4.7,
    availableRooms: 2,
    imageUrl: "https://images.unsplash.com/photo-1673060412036-59cac0c54c64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb3VudGFpbiUyMGxvZGdlJTIwY2FiaW58ZW58MXx8fHwxNzU5OTEyMzIxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral",
    lightPollution: "低",
    altitude: 1600,
  },
];

export default function Home() {
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchParams, setSearchParams] = useState<SearchParams>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleSearch = (year: string, month: string, prefecture: string) => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    setIsLoading(true);
    setSearchParams({ year, month, prefecture });

    timeoutRef.current = window.setTimeout(() => {
      const filteredResults = mockAccommodations.filter(
        (accommodation) => accommodation.prefecture === prefecture,
      );

      setAccommodations(filteredResults);
      setIsLoading(false);
    }, 1200);
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
          新月の夜に最高の星空を楽しめる宿泊施設を見つけましょう。光害が少なく、晴天確率の高い場所を厳選してご紹介します。
        </p>
      </header>

      <main className="mx-auto mt-10 flex w-full max-w-6xl flex-col gap-10">
        <SearchForm onSearch={handleSearch} />
        <SearchResults accommodations={accommodations} isLoading={isLoading} searchParams={searchParams} />
      </main>
    </div>
  );
}
