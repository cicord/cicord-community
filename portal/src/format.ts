/** Locale-aware formatting, shared by the pages (Intl only, no dependency). */
import { useMemo } from "react";
import { useT } from "./i18n/index.tsx";

export interface Formatters {
  number: (n: number) => string;
  /** 12.3k, 1.2M. */
  compact: (n: number) => string;
  /** Hours of voice from seconds: "1,234 h", "42 min" under an hour. */
  hours: (seconds: number) => string;
  /** "+12%", "−3%". */
  percent: (ratio: number) => string;
  date: (iso: string) => string;
  dateTime: (iso: string) => string;
  /** "3 hours ago", "in 2 days". */
  relative: (iso: string) => string;
  /** Short day label for charts: "Nov 24". */
  day: (unixSeconds: number) => string;
  weekday: (mondayFirstIndex: number) => string;
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 3600],
  ["month", 30 * 24 * 3600],
  ["week", 7 * 24 * 3600],
  ["day", 24 * 3600],
  ["hour", 3600],
  ["minute", 60],
];

/** A parsed ISO timestamp, or undefined for an invalid one (shown as is). */
function parse(iso: string): Date | undefined {
  const time = Date.parse(iso);
  return Number.isNaN(time) ? undefined : new Date(time);
}

function createFormatters(locale: string, now: () => number = Date.now): Formatters {
  const number = new Intl.NumberFormat(locale);
  const compact = new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 });
  const percent = new Intl.NumberFormat(locale, {
    style: "percent",
    signDisplay: "exceptZero",
    maximumFractionDigits: 0,
  });
  const hours = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "hour",
    maximumFractionDigits: 0,
  });
  const minutes = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "minute",
    maximumFractionDigits: 0,
  });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const dateTime = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });
  // Spark points are UTC days: label them in UTC so a day never shifts to the previous one.
  const day = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", timeZone: "UTC" });
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  return {
    number: (n) => number.format(n),
    compact: (n) => compact.format(n),
    hours: (s) => (s < 3600 ? minutes.format(s / 60) : hours.format(s / 3600)),
    percent: (r) => percent.format(r),
    date: (iso) => {
      const d = parse(iso);
      return d ? date.format(d) : iso;
    },
    dateTime: (iso) => {
      const d = parse(iso);
      return d ? dateTime.format(d) : iso;
    },
    relative: (iso) => {
      const d = parse(iso);
      if (!d) return iso;
      const seconds = (d.getTime() - now()) / 1000;
      for (const [unit, size] of UNITS) {
        if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
      }
      return relative.format(0, "second");
    },
    day: (unix) => day.format(new Date(unix * 1000)),
    // 2024-01-01 was a Monday.
    weekday: (i) => weekday.format(new Date(Date.UTC(2024, 0, 1 + i))),
  };
}

export function useFormat(): Formatters {
  const t = useT();
  return useMemo(() => createFormatters(t.locale), [t.locale]);
}
