/** Pure helpers of the Activity page: KPI lookup, deltas and the heatmap's time-zone shift. */
import type { AnalyticsKpi, PortalAnalytics } from "@cicord/client";

/** The KPIs the page shows, in the runtime's order (`PortalAnalytics.kpis`). */
export type Metric =
  | "members.total"
  | "members.joined"
  | "members.active"
  | "messages.sent"
  | "voice.seconds"
  | "reactions.added"
  | "bots.commands"
  | "members.active.bots";

export function findKpi(data: PortalAnalytics, metric: Metric): AnalyticsKpi | undefined {
  return data.kpis.find((k) => k.metric === metric);
}

/**
 * Change against the previous period as a ratio (0.12 = +12%), or null when there is
 * nothing honest to compare with: no previous period in the data, or a previous value of 0.
 */
export function delta(value: number, previous: number | null): number | null {
  if (previous === null || previous === 0) return null;
  return (value - previous) / previous;
}

/**
 * The viewer's offset from UTC in minutes, east positive (Paris in winter: 60, New York in
 * winter: -300), at `at`. The heatmap uses the current one; a period across a DST change is
 * off by an hour on one side of it, which the page notes.
 */
export function viewerOffsetMinutes(at: Date = new Date()): number {
  // getTimezoneOffset is west positive.
  return -at.getTimezoneOffset();
}

/**
 * Moves `heatmap[weekday][hour]` (weekday 0 = Monday, UTC hours, as served) to local time
 * for a UTC offset in minutes. Offsets that are not whole hours (India, +5:30) are rounded to
 * the nearest hour, since the data has hourly buckets. Messages that cross midnight move to
 * the previous or next weekday, and Sunday wraps to Monday (the data is a weekly profile).
 */
export function shiftHeatmap(
  heatmap: readonly (readonly number[])[],
  offsetMinutes: number,
): number[][] {
  const shift = Math.round(offsetMinutes / 60);
  const out = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const value = heatmap[day]?.[hour] ?? 0;
      const local = day * 24 + hour + shift;
      const slot = ((local % 168) + 168) % 168;
      out[Math.floor(slot / 24)]![slot % 24]! += value;
    }
  }
  return out;
}

/** "UTC+1", "UTC−5", "UTC+5:30". */
export function formatOffset(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "UTC";
  const sign = offsetMinutes > 0 ? "+" : "−";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

/** The busiest cell of a heatmap: weekday (0 = Monday), hour and value; null when empty. */
export function peak(
  heatmap: readonly (readonly number[])[],
): { day: number; hour: number; value: number } | null {
  let best: { day: number; hour: number; value: number } | null = null;
  heatmap.forEach((row, day) =>
    row.forEach((value, hour) => {
      if (value > 0 && (!best || value > best.value)) best = { day, hour, value };
    }),
  );
  return best;
}
