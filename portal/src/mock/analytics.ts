/**
 * A deterministic fake of `GET /portal/{server}/analytics`: a seeded random walk with a
 * weekly rhythm (quieter weekends, evening peaks in Europe and the Americas), so the same
 * period always shows the same numbers.
 */
import type { AnalyticsKpi, PortalAnalytics, PortalAnalyticsPeriod } from "@cicord/client";

const DAY = 86_400;
const DAYS: Record<PortalAnalyticsPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };
/** The data starts this many days before today (enough for every previous period). */
const HISTORY = 200;

/** mulberry32: a tiny seeded PRNG. */
function random(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

interface Day {
  time: number;
  total: number;
  joined: number;
  active: number;
  messages: number;
  voice: number;
  reactions: number;
  commands: number;
  botUsers: number;
}

/** Every day of the history, oldest first, ending with today (UTC). */
function history(today: number): Day[] {
  const rand = random(20_261_125);
  const days: Day[] = [];
  let total = 610;
  for (let i = HISTORY - 1; i >= 0; i--) {
    const time = today - i * DAY;
    const weekday = (new Date(time * 1000).getUTCDay() + 6) % 7; // 0 = Monday
    const weekend = weekday >= 5 ? 0.62 : 1;
    // Slow growth, plus a release bump around 40 days ago.
    const growth = 1 + (HISTORY - i) / HISTORY / 1.4 + (i > 36 && i < 44 ? 0.55 : 0);
    const joined = Math.round((3 + rand() * 6) * growth * (weekday >= 5 ? 1.2 : 1));
    total += joined - Math.round(rand() * 2.2);
    const active = Math.round((48 + rand() * 22) * growth * weekend);
    const messages = Math.round(active * (5.2 + rand() * 2.6));
    days.push({
      time,
      total,
      joined,
      active,
      messages,
      voice: Math.round((2 + rand() * 5) * 3600 * growth * (weekday >= 5 ? 1.6 : 1)),
      reactions: Math.round(messages * (0.28 + rand() * 0.12)),
      commands: Math.round(active * (0.4 + rand() * 0.35)),
      botUsers: Math.round(active * (0.16 + rand() * 0.08)),
    });
  }
  return days;
}

type Field = Exclude<keyof Day, "time">;

function kpi(
  metric: string,
  field: Field,
  current: Day[],
  previous: Day[],
  how: "sum" | "avg" | "last",
): AnalyticsKpi {
  const reduce = (days: Day[]) => {
    if (days.length === 0) return null;
    if (how === "last") return days.at(-1)![field];
    const sum = days.reduce((a, d) => a + d[field], 0);
    return how === "sum" ? sum : Math.round((sum / days.length) * 10) / 10;
  };
  return {
    metric,
    value: reduce(current) ?? 0,
    previous: reduce(previous),
    spark: current.map((d) => [d.time, d[field]]),
  };
}

/** The 7×24 weekly profile (weekday 0 = Monday, UTC hours) scaled to the period's messages. */
function heatmap(messages: number, seed: number): number[][] {
  const rand = random(seed);
  const raw = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_cell, hour) => {
      // Europe's evening (17–22 UTC) and the Americas' (0–3 UTC), a lull at 4–8 UTC.
      const bump = (center: number, width: number) => {
        const d = Math.min(Math.abs(hour - center), 24 - Math.abs(hour - center));
        return Math.exp(-(d ** 2) / width);
      };
      const europe = bump(19.5, 9);
      const americas = 0.55 * bump(1.5, 6);
      const office = 0.35 * bump(13, 10);
      const weekend = day >= 5 ? 0.7 : 1;
      return Math.max(0, (0.04 + europe + americas + office) * weekend * (0.85 + rand() * 0.3));
    }),
  );
  const sum = raw.flat().reduce((a, b) => a + b, 0);
  return raw.map((row) => row.map((v) => Math.round((v / sum) * messages)));
}

export function mockAnalytics(
  period: PortalAnalyticsPeriod,
  now: Date = new Date(),
): PortalAnalytics {
  const today = Math.floor(now.getTime() / 1000 / DAY) * DAY;
  const all = history(today);
  const n = DAYS[period];
  const current = all.slice(-n);
  const previous = all.slice(-2 * n, -n);
  const messages = current.reduce((a, d) => a + d.messages, 0);
  const iso = (unix: number) => new Date(unix * 1000).toISOString().replace(".000Z", "Z");
  const share = (weights: number[]) => {
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map((w) => Math.round((w / sum) * messages * 0.82));
  };
  const channels = share([42, 21, 14, 9, 6]);
  return {
    server: "cicord",
    period,
    from: iso(today - (n - 1) * DAY),
    to: iso(today + DAY),
    since: iso(all[0]!.time),
    kpis: [
      kpi("members.total", "total", current, previous, "last"),
      kpi("members.joined", "joined", current, previous, "sum"),
      kpi("members.active", "active", current, previous, "avg"),
      kpi("messages.sent", "messages", current, previous, "sum"),
      kpi("voice.seconds", "voice", current, previous, "sum"),
      kpi("reactions.added", "reactions", current, previous, "sum"),
      kpi("bots.commands", "commands", current, previous, "sum"),
      kpi("members.active.bots", "botUsers", current, previous, "avg"),
    ],
    topChannels: [
      { id: "101", name: "general", value: channels[0]! },
      { id: "102", name: "help", value: channels[1]! },
      { id: "103", name: "development", value: channels[2]! },
      { id: "104", name: "plugins", value: channels[3]! },
      { id: "105", name: "showcase", value: channels[4]! },
    ],
    topBotCommands: [
      ["/poll", 0.31],
      ["/warn", 0.12],
      ["/timeout", 0.07],
      ["/warnings", 0.05],
      ["/kick", 0.02],
    ].map(([command, ratio]) => ({
      bot: "Cicord",
      command: command as string,
      value: Math.round(current.reduce((a, d) => a + d.commands, 0) * (ratio as number)),
    })),
    heatmap: heatmap(messages, n),
  };
}
