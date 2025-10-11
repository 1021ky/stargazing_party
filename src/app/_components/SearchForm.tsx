'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DayPicker, type Matcher } from "react-day-picker";

interface SearchFormProps {
    onSearch: (year: string, month: string, day: string, prefecture: string) => void;
}

interface WeatherWindowDay {
    date: string;
    isClearSky: boolean;
    weatherCode: number;
    temperatureMax: number;
    temperatureMin: number;
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

const CLEAR_DAY_MESSAGE = "選択された日は晴れではないため日付を再度選択してください。";

function formatIsoDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
    const [year, month, day] = value.split('-').map((part) => Number.parseInt(part, 10));
    return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatJapaneseDate(value: string): string {
    const date = parseIsoDate(value);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function SearchForm({ onSearch }: SearchFormProps) {
    const [selectedPrefecture, setSelectedPrefecture] = useState<string>('');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [weatherWindow, setWeatherWindow] = useState<WeatherWindowDay[]>([]);
    const [dateRange, setDateRange] = useState<{ start: string | null; end: string | null }>({ start: null, end: null });
    const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
    const [isFetchingWeather, setIsFetchingWeather] = useState<boolean>(false);
    const [weatherError, setWeatherError] = useState<string | null>(null);
    const [annotation, setAnnotation] = useState<string | null>(null);
    const [validationMessage, setValidationMessage] = useState<string | null>(null);

    const weatherAbortControllerRef = useRef<AbortController | null>(null);
    const calendarContainerRef = useRef<HTMLDivElement | null>(null);

    const allowedDateIsoList = useMemo(
        () => weatherWindow.filter((day) => day.isClearSky).map((day) => day.date),
        [weatherWindow],
    );
    const allowedDateSet = useMemo(() => new Set(allowedDateIsoList), [allowedDateIsoList]);
    const allowedDates = useMemo(() => allowedDateIsoList.map((iso) => parseIsoDate(iso)), [allowedDateIsoList]);
    const fromDate = useMemo(() => (dateRange.start ? parseIsoDate(dateRange.start) : undefined), [dateRange.start]);
    const toDate = useMemo(() => (dateRange.end ? parseIsoDate(dateRange.end) : undefined), [dateRange.end]);
    const selectedDateObj = selectedDate ? parseIsoDate(selectedDate) : undefined;
    const isSelectedDateSunny = selectedDate ? allowedDateSet.has(selectedDate) : false;
    const hasSelectableDays = allowedDateIsoList.length > 0;

    useEffect(() => {
        return () => {
            weatherAbortControllerRef.current?.abort();
        };
    }, []);

    useEffect(() => {
        if (!isCalendarOpen) {
            return;
        }
        const handleClickOutside = (event: MouseEvent) => {
            if (calendarContainerRef.current && !calendarContainerRef.current.contains(event.target as Node)) {
                setIsCalendarOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isCalendarOpen]);

    useEffect(() => {
        weatherAbortControllerRef.current?.abort();
        setWeatherError(null);
        setWeatherWindow([]);
        setDateRange({ start: null, end: null });
        if (!selectedPrefecture) {
            setIsFetchingWeather(false);
            return;
        }

        const controller = new AbortController();
        weatherAbortControllerRef.current = controller;
        setIsFetchingWeather(true);

        const fetchClearDays = async () => {
            try {
                const response = await fetch(
                    `/api/prefecture/clear-days?prefecture=${encodeURIComponent(selectedPrefecture)}`,
                    { signal: controller.signal },
                );

                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                    const message = typeof payload?.message === 'string' ? payload.message : '晴れ予報の取得に失敗しました';
                    throw new Error(message);
                }

                const rawDays: unknown[] = Array.isArray(payload?.days) ? payload.days : [];
                const normalizedDays: WeatherWindowDay[] = rawDays
                    .map((item) => {
                        if (!item || typeof item !== 'object') {
                            return null;
                        }
                        const record = item as Record<string, unknown>;
                        const dateValue = record.date;
                        if (typeof dateValue !== 'string' || dateValue.length === 0) {
                            return null;
                        }

                        const weatherCodeRaw = Number(record.weatherCode);
                        const temperatureMaxRaw = Number(record.temperatureMax);
                        const temperatureMinRaw = Number(record.temperatureMin);

                        return {
                            date: dateValue,
                            isClearSky: Boolean(record.isClearSky),
                            weatherCode: Number.isFinite(weatherCodeRaw) ? weatherCodeRaw : Number.NaN,
                            temperatureMax: Number.isFinite(temperatureMaxRaw) ? temperatureMaxRaw : Number.NaN,
                            temperatureMin: Number.isFinite(temperatureMinRaw) ? temperatureMinRaw : Number.NaN,
                        } satisfies WeatherWindowDay;
                    })
                    .filter((day): day is WeatherWindowDay => day !== null)
                    .sort((a, b) => a.date.localeCompare(b.date));

                setWeatherWindow(normalizedDays);
                setDateRange({
                    start: typeof payload?.startDate === 'string' ? payload.startDate : null,
                    end: typeof payload?.endDate === 'string' ? payload.endDate : null,
                });
            } catch (error) {
                if (controller.signal.aborted) {
                    return;
                }
                const message = error instanceof Error ? error.message : '晴れ予報の取得に失敗しました';
                setWeatherError(`晴れ予報の取得に失敗しました: ${message}`);
                setWeatherWindow([]);
            } finally {
                if (!controller.signal.aborted) {
                    setIsFetchingWeather(false);
                }
            }
        };

        fetchClearDays();

        return () => {
            controller.abort();
        };
    }, [selectedPrefecture]);

    useEffect(() => {
        if (!selectedPrefecture || !selectedDate) {
            setAnnotation(null);
            return;
        }
        if (!allowedDateSet.has(selectedDate)) {
            setAnnotation(CLEAR_DAY_MESSAGE);
        } else {
            setAnnotation(null);
        }
    }, [selectedPrefecture, selectedDate, allowedDateSet]);

    useEffect(() => {
        if (selectedDate) {
            setValidationMessage(null);
        }
    }, [selectedDate]);

    useEffect(() => {
        if (selectedPrefecture) {
            setValidationMessage(null);
        }
    }, [selectedPrefecture]);

    const disabledMatchers = useMemo(() => {
        const matchers: Matcher[] = [];
        if (fromDate) {
            matchers.push({ before: fromDate });
        }
        if (toDate) {
            matchers.push({ after: toDate });
        }
        matchers.push((date: Date) => !allowedDateSet.has(formatIsoDate(date)));
        return matchers;
    }, [fromDate, toDate, allowedDateSet]);

    const modifiers = useMemo(() => ({ clear: allowedDates }), [allowedDates]);

    const calendarStatusMessage = useMemo(() => {
        if (!selectedPrefecture) {
            return '都道府県を選択すると晴れの日を確認できます。';
        }
        if (isFetchingWeather) {
            return '晴れ予報を取得中です…';
        }
        if (weatherError) {
            return weatherError;
        }
        if (!hasSelectableDays) {
            return '15日以内に晴れの予報が見つかりませんでした。';
        }
        return '晴れの日だけ選択できます。';
    }, [selectedPrefecture, isFetchingWeather, weatherError, hasSelectableDays]);

    const calendarStatusClass = useMemo(() => {
        if (weatherError) {
            return 'text-rose-500';
        }
        if (!selectedPrefecture || isFetchingWeather) {
            return 'text-slate-500';
        }
        if (!hasSelectableDays) {
            return 'text-amber-600';
        }
        return 'text-slate-500';
    }, [weatherError, selectedPrefecture, isFetchingWeather, hasSelectableDays]);

    const handlePrefectureChange = (event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        setSelectedPrefecture(value);
        setSelectedDate('');
        setAnnotation(null);
        setValidationMessage(null);
        setIsCalendarOpen(false);
    };

    const handleDaySelect = (day: Date | undefined) => {
        if (!day) {
            return;
        }
        const iso = formatIsoDate(day);
        if (!allowedDateSet.has(iso)) {
            setAnnotation(CLEAR_DAY_MESSAGE);
            return;
        }
        setSelectedDate(iso);
        setAnnotation(null);
        setValidationMessage(null);
        setIsCalendarOpen(false);
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selectedPrefecture) {
            setValidationMessage('都道府県を選択してください。');
            return;
        }

        if (!selectedDate) {
            setValidationMessage('晴れの日を選択してください。');
            setIsCalendarOpen(true);
            return;
        }

        if (!allowedDateSet.has(selectedDate)) {
            setValidationMessage(null);
            setAnnotation(CLEAR_DAY_MESSAGE);
            setIsCalendarOpen(true);
            return;
        }

        setValidationMessage(null);
        setAnnotation(null);

        const [year, month, day] = selectedDate.split('-');
        if (year && month && day) {
            onSearch(year, String(Number(month)), String(Number(day)), selectedPrefecture);
        }
    };

    return (
        <section className="mx-auto w-full max-w-3xl">
            <div className="rounded-3xl border bg-white p-6 shadow-sm">
                <h2 className="text-center text-lg font-semibold">星空観察 宿泊施設検索</h2>
                <form className="mt-6 grid gap-6" onSubmit={handleSubmit}>
                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                        <span>日付</span>
                        <div ref={calendarContainerRef} className="relative">
                            <input
                                type="text"
                                name="date-display"
                                readOnly
                                value={selectedDate ? formatJapaneseDate(selectedDate) : ''}
                                placeholder={selectedPrefecture ? '晴れの日を選択してください' : '先に都道府県を選択してください'}
                                onFocus={() => {
                                    if (selectedPrefecture) {
                                        setIsCalendarOpen(true);
                                    }
                                }}
                                onClick={() => {
                                    if (selectedPrefecture) {
                                        setIsCalendarOpen(true);
                                    }
                                }}
                                className="w-full cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                disabled={!selectedPrefecture}
                                aria-haspopup="dialog"
                                aria-expanded={isCalendarOpen}
                                aria-controls="date-picker-popover"
                            />
                            <input type="hidden" name="date" value={selectedDate} />
                            {isCalendarOpen ? (
                                <div
                                    id="date-picker-popover"
                                    className="absolute left-0 top-12 z-20 w-[22rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
                                >
                                    <DayPicker
                                        mode="single"
                                        selected={selectedDateObj}
                                        onSelect={handleDaySelect}
                                        fromDate={fromDate}
                                        toDate={toDate}
                                        disabled={disabledMatchers}
                                        modifiers={modifiers}
                                        modifiersStyles={{
                                            clear: { backgroundColor: '#eff6ff', color: '#0369a1' },
                                            selected: { backgroundColor: '#0284c7', color: '#fff' },
                                        }}
                                        showOutsideDays={false}
                                    />
                                </div>
                            ) : null}
                        </div>
                        {annotation ? (
                            <p className="text-xs text-rose-500">{annotation}</p>
                        ) : null}
                        {validationMessage ? (
                            <p className="text-xs text-rose-500">{validationMessage}</p>
                        ) : null}
                        {calendarStatusMessage ? (
                            <p className={`text-xs ${calendarStatusClass}`}>{calendarStatusMessage}</p>
                        ) : null}
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-slate-700">
                        <span>都道府県</span>
                        <select
                            name="prefecture"
                            required
                            value={selectedPrefecture}
                            onChange={handlePrefectureChange}
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
                        className="w-full rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={!selectedPrefecture || isFetchingWeather || (!isSelectedDateSunny && !!selectedDate)}
                    >
                        星空観察に適した宿を検索
                    </button>
                </form>
            </div>
        </section>
    );
}
