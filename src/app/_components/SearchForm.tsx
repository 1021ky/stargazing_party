'use client';

import { FormEvent, useState } from "react";

interface SearchFormProps {
    onSearch: (year: string, month: string, day: string, prefecture: string) => void;
}

const prefectures = [
    "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
    "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
    "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県",
    "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県",
    "奈良県", "和歌山県", "鳥取県", "島根県", "岡山県", "広島県", "山口県",
    "徳島県", "香川県", "愛媛県", "高知県", "福岡県", "佐賀県", "長崎県",
    "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

// Open-Meteo の許容日付レンジに合わせる（サーバと同じ既定値を使う）
const OPEN_METEO_ALLOWED_START_DATE_MIN = process.env.NEXT_PUBLIC_OPEN_METEO_ALLOWED_START_DATE_MIN ?? '2025-07-10';
const OPEN_METEO_ALLOWED_START_DATE_MAX = process.env.NEXT_PUBLIC_OPEN_METEO_ALLOWED_START_DATE_MAX ?? '2025-10-26';

const minDate = new Date(OPEN_METEO_ALLOWED_START_DATE_MIN + 'T00:00:00Z');
const maxDate = new Date(OPEN_METEO_ALLOWED_START_DATE_MAX + 'T00:00:00Z');

const currentYear = new Date().getFullYear();
// 年は min/max の間だけ表示する
const startYear = minDate.getUTCFullYear();
const endYear = maxDate.getUTCFullYear();
const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
const months = Array.from({ length: 12 }, (_, i) => i + 1);
const days = Array.from({ length: 31 }, (_, i) => i + 1);

export function SearchForm({ onSearch }: SearchFormProps) {
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [selectedDay, setSelectedDay] = useState<string>('');

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const year = (formData.get('year') as string) ?? '';
        const month = (formData.get('month') as string) ?? '';
        const day = (formData.get('day') as string) ?? '';
        const prefecture = (formData.get('prefecture') as string) ?? '';

        if (year && month && day && prefecture) {
            onSearch(year, month, day, prefecture);
        }
    };

    return (
        <section className="mx-auto w-full max-w-3xl">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <h2 className="text-center text-lg font-semibold">星空観察 宿泊施設検索</h2>
                <form className="mt-6 grid gap-6" onSubmit={handleSubmit}>
                    <div className="grid gap-4 sm:grid-cols-3">
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                            <span>年</span>
                            <select
                                name="year"
                                required
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="rounded-full border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            >
                                <option value="" disabled>
                                    年を選択
                                </option>
                                {years.map((year) => {
                                    const yearDisabled = new Date(year, 0, 1) > maxDate || new Date(year, 11, 31) < minDate;
                                    return (
                                        <option key={year} value={String(year)} disabled={yearDisabled}>
                                            {year}年
                                        </option>
                                    );
                                })}
                            </select>
                        </label>

                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                            <span>月</span>
                            <select
                                name="month"
                                required
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                                className="rounded-full border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            >
                                <option value="" disabled>
                                    月を選択
                                </option>
                                {months.map((month) => {
                                    const selYear = Number(selectedYear) || currentYear;
                                    const monthStart = new Date(Date.UTC(selYear, month - 1, 1));
                                    const monthEnd = new Date(Date.UTC(selYear, month - 1, new Date(selYear, month, 0).getDate()));
                                    const monthDisabled = monthEnd < minDate || monthStart > maxDate;
                                    return (
                                        <option key={month} value={String(month)} disabled={monthDisabled}>
                                            {month}月
                                        </option>
                                    );
                                })}
                            </select>
                        </label>
                        <label className="grid gap-2 text-sm font-medium text-slate-700">
                            <span>日</span>
                            <select
                                name="day"
                                required
                                value={selectedDay}
                                onChange={(e) => setSelectedDay(e.target.value)}
                                className="rounded-full border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                            >
                                <option value="" disabled>
                                    日を選択
                                </option>
                                {days.map((day) => {
                                    const selYear = Number(selectedYear) || currentYear;
                                    const selMonth = Number(selectedMonth) || 1;
                                    const candidate = new Date(Date.UTC(selYear, selMonth - 1, day));
                                    const dayDisabled = candidate < minDate || candidate > maxDate;
                                    return (
                                        <option key={day} value={String(day)} disabled={dayDisabled}>
                                            {day}日
                                        </option>
                                    );
                                })}
                            </select>
                        </label>
                    </div>

                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                        <span>都道府県</span>
                        <select
                            name="prefecture"
                            required
                            defaultValue=""
                            className="rounded-full border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                        >
                            <option value="" disabled>
                                都道府県を選択
                            </option>
                            {prefectures.map((prefecture) => (
                                <option key={prefecture} value={prefecture}>
                                    {prefecture}
                                </option>
                            ))}
                        </select>
                    </label>

                    <button
                        type="submit"
                        className="w-full rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
                    >
                        星空観察に適した宿を検索
                    </button>
                </form>
            </div>
        </section>
    );
}
