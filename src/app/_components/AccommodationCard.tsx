import { Calendar, Cloud, MapPin, Star } from "lucide-react";

export type LightPollutionLevel = "低" | "中" | "高";

export interface Accommodation {
    id: string;
    name: string;
    location: string;
    prefecture: string;
    newMoonDate: string;
    clearSkyProbability: number;
    price: number;
    rating: number;
    availableRooms: number;
    imageUrl: string;
    lightPollution: LightPollutionLevel;
    altitude: number;
    bookingUrl: string;
}

interface AccommodationCardProps {
    accommodation: Accommodation;
}

const lightPollutionStyles: Record<LightPollutionLevel, string> = {
    低: "bg-emerald-100 text-emerald-900",
    中: "bg-amber-100 text-amber-900",
    高: "bg-rose-100 text-rose-900",
};

export function AccommodationCard({ accommodation }: AccommodationCardProps) {
    const badgeClass = lightPollutionStyles[accommodation.lightPollution] ?? "bg-slate-100 text-slate-900";

    return (
        <article className="overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-lg">
            <div className="relative aspect-video bg-slate-200">
                <img
                    src={accommodation.imageUrl}
                    alt={accommodation.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                />
                <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                    光害: {accommodation.lightPollution}
                </span>
            </div>

            <div className="space-y-4 px-6 py-5">
                <div className="flex items-start justify-between gap-3">
                    <h3 className="text-lg font-semibold leading-tight line-clamp-2">{accommodation.name}</h3>
                    <span className="flex items-center gap-1 text-sm text-yellow-500">
                        <Star className="h-4 w-4 fill-yellow-400" />
                        {accommodation.rating}
                    </span>
                </div>

                <dl className="space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span>{accommodation.location}, {accommodation.prefecture}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>新月: {accommodation.newMoonDate}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <Cloud className="h-4 w-4" />
                        <span>晴天確率: {accommodation.clearSkyProbability}%</span>
                    </div>
                    <div>標高: {accommodation.altitude}m</div>
                </dl>

                <div className="flex items-center justify-between text-sm">
                    <p className="text-slate-500">残り{accommodation.availableRooms}室</p>
                    <p className="text-right text-lg font-bold">
                        ¥{accommodation.price.toLocaleString()}
                        <span className="ml-1 text-xs font-normal text-slate-500">/泊</span>
                    </p>
                </div>

                <a
                    href={accommodation.bookingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full rounded-full bg-sky-600 px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-sky-700"
                >
                    予約する
                </a>
            </div>
        </article>
    );
}
