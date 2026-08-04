"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./ReservationCalendar.module.css";

interface MonthAvailabilityResponse {
  year: number;
  month: number;
  capacity: number;
  days: { date: string; remaining: number }[];
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function todayUtcStr(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
    .toISOString()
    .slice(0, 10);
}

// 残り台数に応じた表示記号: 4台以上=○, 1〜3台=△, 0台=×
function availabilityMark(remaining: number): { symbol: string; className: string } {
  if (remaining <= 0) return { symbol: "×", className: styles.markNone };
  if (remaining <= 3) return { symbol: "△", className: styles.markFew };
  return { symbol: "○", className: styles.markMany };
}

interface ReservationCalendarProps {
  selectedDate: string;
  onSelect: (date: string) => void;
  onRemainingChange?: (remaining: number | null) => void;
}

export default function ReservationCalendar({
  selectedDate,
  onSelect,
  onRemainingChange,
}: ReservationCalendarProps) {
  const today = todayUtcStr();
  const [initialYear, initialMonth] = selectedDate.split("-").map(Number);
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [monthData, setMonthData] = useState<Map<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/availability/month?year=${viewYear}&month=${viewMonth}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "取得に失敗しました");
        const monthResponse = data as MonthAvailabilityResponse;
        setMonthData(new Map(monthResponse.days.map((d) => [d.date, d.remaining])));
        setError(null);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setMonthData(null);
        setError(err.message);
      });
    return () => controller.abort();
  }, [viewYear, viewMonth]);

  useEffect(() => {
    onRemainingChange?.(monthData?.get(selectedDate) ?? null);
  }, [monthData, selectedDate, onRemainingChange]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(Date.UTC(viewYear, viewMonth - 1, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(viewYear, viewMonth, 0)).getUTCDate();
    const list: ({ day: number; date: string; weekday: number } | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(Date.UTC(viewYear, viewMonth - 1, d));
      list.push({
        day: d,
        date: dateObj.toISOString().slice(0, 10),
        weekday: dateObj.getUTCDay(),
      });
    }
    return list;
  }, [viewYear, viewMonth]);

  const canGoPrev = `${viewYear}-${String(viewMonth).padStart(2, "0")}` > today.slice(0, 7);

  function goPrevMonth() {
    const prev = new Date(Date.UTC(viewYear, viewMonth - 2, 1));
    setViewYear(prev.getUTCFullYear());
    setViewMonth(prev.getUTCMonth() + 1);
  }

  function goNextMonth() {
    const next = new Date(Date.UTC(viewYear, viewMonth, 1));
    setViewYear(next.getUTCFullYear());
    setViewMonth(next.getUTCMonth() + 1);
  }

  return (
    <div className={styles.card}>
      <h2 className={styles.title}>日付を選ぶ</h2>

      <div className={styles.monthNav}>
        <button type="button" onClick={goPrevMonth} disabled={!canGoPrev} aria-label="前の月">
          ‹
        </button>
        <span className={styles.monthLabel}>
          {viewYear}年{viewMonth}月
        </span>
        <button type="button" onClick={goNextMonth} aria-label="次の月">
          ›
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={[styles.weekday, i === 0 ? styles.sun : "", i === 6 ? styles.sat : ""].join(" ")}
          >
            {w}
          </div>
        ))}

        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} className={styles.cell} />;

          const isPast = cell.date < today;
          const isSelected = cell.date === selectedDate;
          const remaining = monthData?.get(cell.date);
          const soldOut = remaining === 0;

          return (
            <button
              key={cell.date}
              type="button"
              disabled={isPast || soldOut}
              onClick={() => onSelect(cell.date)}
              className={[styles.cell, styles.dayCell, isSelected ? styles.selected : ""].join(" ")}
            >
              <span
                className={[
                  styles.dayNumber,
                  cell.weekday === 0 ? styles.sun : "",
                  cell.weekday === 6 ? styles.sat : "",
                ].join(" ")}
              >
                {cell.day}
              </span>
              {isPast ? (
                <span className={styles.markNone}>×</span>
              ) : remaining === undefined ? (
                <span className={styles.markLoading}>-</span>
              ) : (
                <span className={availabilityMark(remaining).className}>
                  {availabilityMark(remaining).symbol}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
