"use client";

import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { DayPicker, type Matcher } from "react-day-picker";
import { MoonDayButton } from "./MoonDayButton";
import { PrefectureMapPicker } from "./PrefectureMapPicker";

interface SearchFormProps {
  onSearch: (
    year: string,
    month: string,
    day: string,
    prefecture: string,
  ) => void;
}

interface WeatherWindowDay {
  date: string;
  isClearSky: boolean;
  weatherCode: number;
  temperatureMax: number;
  temperatureMin: number;
}

const CLEAR_DAY_MESSAGE =
  "選択された日は晴れではないため日付を再度選択してください。";

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseIsoDate(value: string): Date {
  const [year, month, day] = value
    .split("-")
    .map((part) => Number.parseInt(part, 10));
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatJapaneseDate(value: string): string {
  const date = parseIsoDate(value);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function SearchForm({ onSearch }: SearchFormProps) {
  const [selectedPrefecture, setSelectedPrefecture] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("指定なし");
  const [minRating, setMinRating] = useState<string>("指定なし");
  const [weatherWindow, setWeatherWindow] = useState<WeatherWindowDay[]>([]);
  const [dateRange, setDateRange] = useState<{
    start: string | null;
    end: string | null;
  }>({ start: null, end: null });
  const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
  const [isFetchingWeather, setIsFetchingWeather] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [weatherNotice, setWeatherNotice] = useState<string | null>(null);
  const [annotation, setAnnotation] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  const weatherAbortControllerRef = useRef<AbortController | null>(null);
  const calendarContainerRef = useRef<HTMLDivElement | null>(null);

  const allowedDateIsoList = useMemo(
    () => weatherWindow.filter((day) => day.isClearSky).map((day) => day.date),
    [weatherWindow],
  );
  const allowedDateSet = useMemo(
    () => new Set(allowedDateIsoList),
    [allowedDateIsoList],
  );
  const allowedDates = useMemo(
    () => allowedDateIsoList.map((iso) => parseIsoDate(iso)),
    [allowedDateIsoList],
  );
  const fromDate = useMemo(
    () => (dateRange.start ? parseIsoDate(dateRange.start) : undefined),
    [dateRange.start],
  );
  const toDate = useMemo(
    () => (dateRange.end ? parseIsoDate(dateRange.end) : undefined),
    [dateRange.end],
  );
  const selectedDateObj = selectedDate ? parseIsoDate(selectedDate) : undefined;
  const isSelectedDateSunny = selectedDate
    ? allowedDateSet.has(selectedDate)
    : false;
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
      if (
        calendarContainerRef.current &&
        !calendarContainerRef.current.contains(event.target as Node)
      ) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isCalendarOpen]);

  useEffect(() => {
    weatherAbortControllerRef.current?.abort();
    setWeatherError(null);
    setWeatherNotice(null);
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
          const message =
            typeof payload?.message === "string"
              ? payload.message
              : "晴れ予報の取得に失敗しました";
          throw new Error(message);
        }

        const rawDays: unknown[] = Array.isArray(payload?.days)
          ? payload.days
          : [];
        const normalizedDays: WeatherWindowDay[] = rawDays
          .map((item) => {
            if (!item || typeof item !== "object") {
              return null;
            }
            const record = item as Record<string, unknown>;
            const dateValue = record.date;
            if (typeof dateValue !== "string" || dateValue.length === 0) {
              return null;
            }

            const weatherCodeRaw = Number(record.weatherCode);
            const temperatureMaxRaw = Number(record.temperatureMax);
            const temperatureMinRaw = Number(record.temperatureMin);

            return {
              date: dateValue,
              isClearSky: Boolean(record.isClearSky),
              weatherCode: Number.isFinite(weatherCodeRaw)
                ? weatherCodeRaw
                : Number.NaN,
              temperatureMax: Number.isFinite(temperatureMaxRaw)
                ? temperatureMaxRaw
                : Number.NaN,
              temperatureMin: Number.isFinite(temperatureMinRaw)
                ? temperatureMinRaw
                : Number.NaN,
            } satisfies WeatherWindowDay;
          })
          .filter((day): day is WeatherWindowDay => day !== null)
          .sort((a, b) => a.date.localeCompare(b.date));

        setWeatherWindow(normalizedDays);
        setDateRange({
          start:
            typeof payload?.startDate === "string" ? payload.startDate : null,
          end: typeof payload?.endDate === "string" ? payload.endDate : null,
        });

        if (
          payload?.availability === "out_of_supported_range" &&
          typeof payload?.message === "string"
        ) {
          setWeatherNotice(payload.message);
        } else {
          setWeatherNotice(null);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "晴れ予報の取得に失敗しました";
        setWeatherError(`晴れ予報の取得に失敗しました: ${message}`);
        setWeatherNotice(null);
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
      return "都道府県を選択すると晴れの日を確認できます。";
    }
    if (isFetchingWeather) {
      return "晴れ予報を取得中です…";
    }
    if (weatherError) {
      return weatherError;
    }
    if (weatherNotice) {
      return weatherNotice;
    }
    if (!hasSelectableDays) {
      return "15日以内に晴れの予報が見つかりませんでした。";
    }
    return "晴れの日だけ選択できます。";
  }, [
    selectedPrefecture,
    isFetchingWeather,
    weatherError,
    weatherNotice,
    hasSelectableDays,
  ]);

  const calendarStatusClass = useMemo(() => {
    if (weatherError) {
      return "text-rose-500";
    }
    if (weatherNotice) {
      return "text-amber-600";
    }
    if (!selectedPrefecture || isFetchingWeather) {
      return "text-slate-500";
    }
    if (!hasSelectableDays) {
      return "text-amber-600";
    }
    return "text-slate-500";
  }, [
    weatherError,
    weatherNotice,
    selectedPrefecture,
    isFetchingWeather,
    hasSelectableDays,
  ]);

  const handlePrefectureChange = (value: string) => {
    setSelectedPrefecture(value);
    setSelectedDate("");
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
      setValidationMessage("地図を操作して検索エリアを選択してください。");
      return;
    }

    if (!selectedDate) {
      setValidationMessage("晴れの日を選択してください。");
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

    const [year, month, day] = selectedDate.split("-");
    if (year && month && day) {
      onSearch(
        year,
        String(Number(month)),
        String(Number(day)),
        selectedPrefecture,
      );
    }
  };

  return (
    <section className="relative h-full w-full overflow-hidden bg-slate-900">
      <PrefectureMapPicker
        value={selectedPrefecture}
        onChange={handlePrefectureChange}
      />

      <div className="pointer-events-none absolute inset-x-3 top-3 z-[500] sm:inset-x-auto sm:left-4 sm:w-[25rem] lg:w-[24rem]">
        <div className="pointer-events-auto rounded-2xl border border-white/45 bg-white/78 p-4 shadow-xl backdrop-blur-md">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            星空宿泊マップ検索
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-700">
            地図をクリックして検索エリアを選び、表示エリアに合わせた日付と条件で宿を探します。
          </p>

          <form className="mt-4 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              <span>日付</span>
              <div ref={calendarContainerRef} className="relative">
                <input
                  type="text"
                  name="date-display"
                  readOnly
                  value={selectedDate ? formatJapaneseDate(selectedDate) : ""}
                  placeholder={
                    selectedPrefecture
                      ? "晴れの日を選択してください"
                      : "先に地図でエリアを選択してください"
                  }
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
                  className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  disabled={!selectedPrefecture}
                  aria-haspopup="dialog"
                />
                <input type="hidden" name="date" value={selectedDate} />
                {isCalendarOpen ? (
                  <div
                    id="date-picker-popover"
                    className="absolute left-0 top-12 z-20 w-[21rem] rounded-2xl border border-slate-200 bg-white p-3 shadow-lg"
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
                        clear: { backgroundColor: "#eff6ff", color: "#0369a1" },
                        selected: { backgroundColor: "#0284c7", color: "#fff" },
                      }}
                      components={{ DayButton: MoonDayButton }}
                      showOutsideDays={false}
                    />
                  </div>
                ) : null}
              </div>
              {annotation ? (
                <p className="text-xs text-rose-600">{annotation}</p>
              ) : null}
              {validationMessage ? (
                <p className="text-xs text-rose-600">{validationMessage}</p>
              ) : null}
              {calendarStatusMessage ? (
                <p className={`text-xs ${calendarStatusClass}`}>
                  {calendarStatusMessage}
                </p>
              ) : null}
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                <span>価格</span>
                <select
                  value={maxPrice}
                  onChange={(event) => setMaxPrice(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700"
                >
                  <option>指定なし</option>
                  <option>¥10,000以下</option>
                  <option>¥20,000以下</option>
                  <option>¥30,000以下</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium text-slate-700">
                <span>評価</span>
                <select
                  value={minRating}
                  onChange={(event) => setMinRating(event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700"
                >
                  <option>指定なし</option>
                  <option>4.5以上</option>
                  <option>4.0以上</option>
                  <option>3.5以上</option>
                </select>
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={
                !selectedPrefecture ||
                isFetchingWeather ||
                (!isSelectedDateSunny && !!selectedDate)
              }
            >
              表示エリアで宿を検索
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
