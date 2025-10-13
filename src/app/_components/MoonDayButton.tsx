"use client";

import React from "react";

// Minimal props to match DayPicker's DayButton signature without importing internals.
interface MoonDayButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    day: any; // CalendarDay (avoid importing internal type)
    modifiers: Record<string, boolean>;
}

// Same synodic month value used elsewhere in the app.
const SYNODIC_MONTH_DAYS = 29.530588853;
// Align with reference new moon used on server side formatting logic.
const REFERENCE_NEW_MOON_ISO = "2024-01-11T11:57:00Z";

function clampAge(age: number): number {
    if (!Number.isFinite(age)) return 0;
    if (age < 0) return 0;
    if (age > 29) return 29;
    return Math.floor(age);
}

function dateToMoonAgeIndex(date: Date): number {
    // Use local midnight to keep the day-based mapping stable.
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const t0 = new Date(REFERENCE_NEW_MOON_ISO);
    const msPerDay = 86_400_000;
    const diffDays = (dayStart.getTime() - t0.getTime()) / msPerDay;
    // Normalize to [0, synodic) then map to 0..29 with floor.
    const cyclePos = ((diffDays % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
    const age = Math.floor((cyclePos / SYNODIC_MONTH_DAYS) * 30);
    return clampAge(age);
}

export function MoonDayButton(props: MoonDayButtonProps) {
    const { day, modifiers, style, children, ...rest } = props;

    // The calendar provides a CalendarDay wrapper; use its date.
    const date = (day as any).date instanceof Date ? (day as any).date : new Date();
    const age = dateToMoonAgeIndex(date);
    const imgUrl = `/moon/moon_${String(age).padStart(2, "0")}.jpg`;

    // Compose inline styles: keep existing styles and add background image.
    const composedStyle: React.CSSProperties = {
        ...style,
        backgroundImage: `url(${imgUrl})`,
        backgroundSize: "24px 24px",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center 6px",
        paddingTop: "30px", // push numeral below the icon
    };

    // Preserve the day number (default children) for readability.
    return (
        <button {...rest} style={composedStyle} aria-label={rest["aria-label"]}>
            {children}
        </button>
    );
}

export default MoonDayButton;
